import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrainingExample {
  id: string;
  user_id: string;
  review_id: string;
  reply_content: string;
  review_rating: number;
  review_text: string | null;
  sentiment: string;
  notes: string | null;
  created_at: string;
  is_active: boolean;
}

export const useTrainingExamples = () => {
  const queryClient = useQueryClient();

  const { data: trainingExamples, isLoading } = useQuery({
    queryKey: ["training-examples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_examples")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrainingExample[];
    },
  });

  const addExample = useMutation({
    mutationFn: async (example: {
      review_id: string;
      reply_content: string;
      review_rating: number;
      review_text?: string;
      sentiment: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("training_examples")
        .insert({ ...example, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
  });

  const updateExample = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TrainingExample> }) => {
      const { data, error } = await supabase
        .from("training_examples")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
  });

  const deleteExample = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_examples")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
  });

  return {
    trainingExamples,
    isLoading,
    addExample,
    updateExample,
    deleteExample,
  };
};
