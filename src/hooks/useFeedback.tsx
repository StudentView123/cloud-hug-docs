import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export interface FeedbackFormData {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export type FeedbackSubmission = Tables<'feedback_submissions'>;

export const useSubmitFeedback = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      const { data: result, error } = await supabase.functions.invoke('submit-feedback', {
        body: data
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-history'] });
    }
  });
};

export const useFeedbackHistory = () => {
  return useQuery({
    queryKey: ['feedback-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FeedbackSubmission[];
    }
  });
};
