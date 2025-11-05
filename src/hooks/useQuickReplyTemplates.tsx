import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface QuickReplyTemplate {
  id: string;
  user_id: string;
  rating_min: number;
  rating_max: number;
  template_text: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

export const useQuickReplyTemplates = () => {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["quick-reply-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_reply_templates")
        .select("*")
        .order("rating_min", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as QuickReplyTemplate[];
    },
  });

  const addTemplate = useMutation({
    mutationFn: async (template: {
      rating_min: number;
      rating_max: number;
      template_text: string;
      is_active?: boolean;
      usage_count?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quick_reply_templates")
        .insert({ ...template, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-reply-templates"] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<QuickReplyTemplate> }) => {
      const { data, error } = await supabase
        .from("quick_reply_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-reply-templates"] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quick_reply_templates")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-reply-templates"] });
    },
  });

  return {
    templates,
    isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
};
