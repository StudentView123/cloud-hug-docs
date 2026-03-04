export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          review_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          review_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          review_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          review_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          review_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          review_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token: string | null
          connection_status: string
          created_at: string
          google_account_email: string | null
          google_account_name: string | null
          google_account_picture_url: string | null
          id: string
          last_error: string | null
          last_refreshed_at: string | null
          last_sync_at: string | null
          provider: string
          refresh_token: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          google_account_email?: string | null
          google_account_name?: string | null
          google_account_picture_url?: string | null
          id?: string
          last_error?: string | null
          last_refreshed_at?: string | null
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          google_account_email?: string | null
          google_account_name?: string | null
          google_account_picture_url?: string | null
          id?: string
          last_error?: string | null
          last_refreshed_at?: string | null
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          google_location_id: string
          id: string
          name: string
          rating: number | null
          review_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          google_location_id: string
          id?: string
          name: string
          rating?: number | null
          review_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          google_location_id?: string
          id?: string
          name?: string
          rating?: number | null
          review_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          email: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          id: string
          reply_style_settings: Json | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          email?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          id: string
          reply_style_settings?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          email?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          id?: string
          reply_style_settings?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          credit_amount: number
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          credit_amount: number
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          credit_amount?: number
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          credits_awarded: number
          id: string
          promo_code_id: string
          redeemed_at: string | null
          user_id: string
        }
        Insert: {
          credits_awarded: number
          id?: string
          promo_code_id: string
          redeemed_at?: string | null
          user_id: string
        }
        Update: {
          credits_awarded?: number
          id?: string
          promo_code_id?: string
          redeemed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_reply_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          rating_max: number
          rating_min: number
          template_text: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rating_max: number
          rating_min: number
          template_text: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rating_max?: number
          rating_min?: number
          template_text?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_reply_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_reply_usage_history: {
        Row: {
          id: string
          review_id: string | null
          template_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          review_id?: string | null
          template_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          review_id?: string | null
          template_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_reply_usage_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_usage_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quick_reply_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_usage_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      received_emails: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          created_at: string | null
          email_id: string
          from_address: string
          id: string
          is_read: boolean | null
          subject: string | null
          to_address: string
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          email_id: string
          from_address: string
          id?: string
          is_read?: boolean | null
          subject?: string | null
          to_address: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          email_id?: string
          from_address?: string
          id?: string
          is_read?: boolean | null
          subject?: string | null
          to_address?: string
        }
        Relationships: []
      }
      replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai_generated: boolean | null
          needs_review: boolean | null
          posted_at: string | null
          review_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          needs_review?: boolean | null
          posted_at?: string | null
          review_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          needs_review?: boolean | null
          posted_at?: string | null
          review_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          archived: boolean | null
          author_name: string
          author_photo_url: string | null
          created_at: string
          google_reply_content: string | null
          google_reply_time: string | null
          google_review_id: string
          has_google_reply: boolean | null
          id: string
          last_rating_change_at: string | null
          location_id: string
          rating: number
          rating_history: Json | null
          review_created_at: string
          sentiment: string | null
          sentiment_mismatch: boolean | null
          text: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean | null
          author_name: string
          author_photo_url?: string | null
          created_at?: string
          google_reply_content?: string | null
          google_reply_time?: string | null
          google_review_id: string
          has_google_reply?: boolean | null
          id?: string
          last_rating_change_at?: string | null
          location_id: string
          rating: number
          rating_history?: Json | null
          review_created_at: string
          sentiment?: string | null
          sentiment_mismatch?: boolean | null
          text?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean | null
          author_name?: string
          author_photo_url?: string | null
          created_at?: string
          google_reply_content?: string | null
          google_reply_time?: string | null
          google_review_id?: string
          has_google_reply?: boolean | null
          id?: string
          last_rating_change_at?: string | null
          location_id?: string
          rating?: number
          rating_history?: Json | null
          review_created_at?: string
          sentiment?: string | null
          sentiment_mismatch?: boolean | null
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_examples: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          reply_content: string
          review_id: string | null
          review_rating: number
          review_text: string | null
          sentiment: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          reply_content: string
          review_id?: string | null
          review_rating: number
          review_text?: string | null
          sentiment: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          reply_content?: string
          review_id?: string | null
          review_rating?: number
          review_text?: string | null
          sentiment?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_examples_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_examples_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          event_id: string
          event_type: string
          failed_at: string | null
          id: string
          payload: Json
          resource_id: string
          resource_type: string
          response_body: string | null
          response_status: number | null
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          event_id?: string
          event_type: string
          failed_at?: string | null
          id?: string
          payload?: Json
          resource_id: string
          resource_type: string
          response_body?: string | null
          response_status?: number | null
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          event_id?: string
          event_type?: string
          failed_at?: string | null
          id?: string
          payload?: Json
          resource_id?: string
          resource_type?: string
          response_body?: string | null
          response_status?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_delivery_at: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          last_success_at: string | null
          signing_secret: string
          signing_secret_hash: string
          signing_secret_hint: string
          subscribed_events: string[]
          target_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          last_delivery_at?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          signing_secret: string
          signing_secret_hash: string
          signing_secret_hint: string
          subscribed_events?: string[]
          target_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_delivery_at?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          signing_secret?: string
          signing_secret_hash?: string
          signing_secret_hint?: string
          subscribed_events?: string[]
          target_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      revoke_api_key: {
        Args: { _api_key_id: string }
        Returns: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      touch_api_key_last_used: {
        Args: { _key_hash: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
