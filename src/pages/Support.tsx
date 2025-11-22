import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubmitFeedback, useFeedbackHistory } from "@/hooks/useFeedback";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const feedbackSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email").max(255, "Email must be less than 255 characters"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be less than 200 characters"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export default function Support() {
  const { toast } = useToast();
  const { mutate: submitFeedback, isPending } = useSubmitFeedback();
  const { data: feedbackHistory, isLoading: isLoadingHistory } = useFeedbackHistory();

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  // Pre-fill user data if logged in
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();
        
        if (profile?.email) {
          form.setValue('email', profile.email);
        }
      }
    };
    loadUserData();
  }, [form]);

  const onSubmit = (data: FeedbackFormValues) => {
    submitFeedback(data, {
      onSuccess: () => {
        toast({
          title: "Feedback sent!",
          description: "We'll get back to you as soon as possible.",
        });
        form.reset();
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to send feedback. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const messageLength = form.watch("message")?.length || 0;
  const subjectLength = form.watch("subject")?.length || 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Headphones className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Support & Feedback</h1>
          <p className="text-muted-foreground">Send us your feedback and we'll get back to you directly</p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Send Feedback</CardTitle>
          <CardDescription>
            We'll reply directly to your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  {...form.register("name")}
                  disabled={isPending}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...form.register("email")}
                  disabled={isPending}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
                <p className="text-xs text-muted-foreground">We'll reply to this email</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="subject">Subject</Label>
                <span className="text-xs text-muted-foreground">{subjectLength}/200</span>
              </div>
              <Input
                id="subject"
                placeholder="Brief summary of your feedback"
                {...form.register("subject")}
                disabled={isPending}
              />
              {form.formState.errors.subject && (
                <p className="text-sm text-destructive">{form.formState.errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="message">Message</Label>
                <span className="text-xs text-muted-foreground">{messageLength}/2000</span>
              </div>
              <Textarea
                id="message"
                placeholder="Describe your feedback in detail..."
                className="min-h-[150px] resize-none"
                {...form.register("message")}
                disabled={isPending}
              />
              {form.formState.errors.message && (
                <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full md:w-auto">
              {isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {feedbackHistory && feedbackHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Submissions</CardTitle>
            <CardDescription>Previously submitted feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{item.subject}</h3>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
