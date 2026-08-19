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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      automation_tasks: {
        Row: {
          attempts: number
          buyer_username: string | null
          claimed_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          order_id: string
          payload: Json
          result: string | null
          status: string
          task_type: string
          user_id: string
        }
        Insert: {
          attempts?: number
          buyer_username?: string | null
          claimed_at?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id: string
          payload?: Json
          result?: string | null
          status?: string
          task_type: string
          user_id: string
        }
        Update: {
          attempts?: number
          buyer_username?: string | null
          claimed_at?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id?: string
          payload?: Json
          result?: string | null
          status?: string
          task_type?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          agent_last_seen_at: string | null
          agent_token: string
          agent_version: string | null
          auto_release: boolean
          binance_api_key: string | null
          binance_api_secret: string | null
          bot_running: boolean
          country: string
          created_at: string
          id: string
          last_poll_at: string | null
          last_poll_status: string | null
          notify_ambiguity: boolean
          notify_appeal: boolean
          notify_new_order: boolean
          notify_paid: boolean
          notify_release: boolean
          notify_sms: boolean
          poll_interval_seconds: number
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
          webhook_token: string
        }
        Insert: {
          agent_last_seen_at?: string | null
          agent_token?: string
          agent_version?: string | null
          auto_release?: boolean
          binance_api_key?: string | null
          binance_api_secret?: string | null
          bot_running?: boolean
          country?: string
          created_at?: string
          id?: string
          last_poll_at?: string | null
          last_poll_status?: string | null
          notify_ambiguity?: boolean
          notify_appeal?: boolean
          notify_new_order?: boolean
          notify_paid?: boolean
          notify_release?: boolean
          notify_sms?: boolean
          poll_interval_seconds?: number
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
          webhook_token?: string
        }
        Update: {
          agent_last_seen_at?: string | null
          agent_token?: string
          agent_version?: string | null
          auto_release?: boolean
          binance_api_key?: string | null
          binance_api_secret?: string | null
          bot_running?: boolean
          country?: string
          created_at?: string
          id?: string
          last_poll_at?: string | null
          last_poll_status?: string | null
          notify_ambiguity?: boolean
          notify_appeal?: boolean
          notify_new_order?: boolean
          notify_paid?: boolean
          notify_release?: boolean
          notify_sms?: boolean
          poll_interval_seconds?: number
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
          webhook_token?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          asset: string
          buyer_real_name: string | null
          buyer_username: string | null
          created_at: string
          crypto_amount: number
          fiat_amount: number
          fiat_currency: string
          id: string
          match_ambiguous: boolean
          order_created_at: string | null
          order_id: string
          payment_method: string | null
          payment_verified: boolean
          raw: Json | null
          released: boolean
          released_at: string | null
          status: string
          trade_type: string | null
          unit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset?: string
          buyer_real_name?: string | null
          buyer_username?: string | null
          created_at?: string
          crypto_amount?: number
          fiat_amount?: number
          fiat_currency?: string
          id?: string
          match_ambiguous?: boolean
          order_created_at?: string | null
          order_id: string
          payment_method?: string | null
          payment_verified?: boolean
          raw?: Json | null
          released?: boolean
          released_at?: string | null
          status?: string
          trade_type?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          buyer_real_name?: string | null
          buyer_username?: string | null
          created_at?: string
          crypto_amount?: number
          fiat_amount?: number
          fiat_currency?: string
          id?: string
          match_ambiguous?: boolean
          order_created_at?: string | null
          order_id?: string
          payment_method?: string | null
          payment_verified?: boolean
          raw?: Json | null
          released?: boolean
          released_at?: string | null
          status?: string
          trade_type?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_name: string
          account_number: string | null
          bank_name: string
          country: string
          created_at: string
          iban: string | null
          id: string
          is_active: boolean
          method_type: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          bank_name: string
          country: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          method_type: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          bank_name?: string
          country?: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          method_type?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          action_taken: string | null
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          match_status: string
          matched_buyer_username: string | null
          matched_order_id: string | null
          payer_name: string | null
          raw_text: string
          receiver_name: string | null
          reference_id: string | null
          sender: string | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          match_status?: string
          matched_buyer_username?: string | null
          matched_order_id?: string | null
          payer_name?: string | null
          raw_text: string
          receiver_name?: string | null
          reference_id?: string | null
          sender?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          match_status?: string
          matched_buyer_username?: string | null
          matched_order_id?: string | null
          payer_name?: string | null
          raw_text?: string
          receiver_name?: string | null
          reference_id?: string | null
          sender?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          level: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          level?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          level?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
