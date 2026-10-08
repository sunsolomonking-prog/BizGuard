// Supabase Database Types for BizGuard
// Generated types - update when schema changes

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      system_health_events: {
        Row: { id: string; business_id: string | null; service: string; status: string; latency_ms: number | null; message: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id?: string | null; service: string; status: string; latency_ms?: number | null; message?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string | null; service?: string; status?: string; latency_ms?: number | null; message?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      error_events: {
        Row: { id: string; business_id: string | null; user_id: string | null; source: string; severity: string; message: string; stack: string | null; context: Json; resolved_at: string | null; created_at: string; };
        Insert: { id?: string; business_id?: string | null; user_id?: string | null; source: string; severity?: string; message: string; stack?: string | null; context?: Json; resolved_at?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string | null; user_id?: string | null; source?: string; severity?: string; message?: string; stack?: string | null; context?: Json; resolved_at?: string | null; created_at?: string; };
        Relationships: [];
      };
      user_analytics_events: {
        Row: { id: string; business_id: string | null; user_id: string | null; event_name: string; feature: string; session_id: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id?: string | null; user_id?: string | null; event_name: string; feature: string; session_id?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string | null; user_id?: string | null; event_name?: string; feature?: string; session_id?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      business_events: {
        Row: { id: string; business_id: string; actor_id: string | null; event_type: string; entity_type: string | null; entity_id: string | null; description: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id: string; actor_id?: string | null; event_type: string; entity_type?: string | null; entity_id?: string | null; description?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string; actor_id?: string | null; event_type?: string; entity_type?: string | null; entity_id?: string | null; description?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      security_events: {
        Row: { id: string; business_id: string | null; user_id: string | null; event_type: string; severity: string; ip_address: string | null; user_agent: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id?: string | null; user_id?: string | null; event_type: string; severity?: string; ip_address?: string | null; user_agent?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string | null; user_id?: string | null; event_type?: string; severity?: string; ip_address?: string | null; user_agent?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      performance_events: {
        Row: { id: string; business_id: string | null; page: string; metric_name: string; metric_value: number; rating: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id?: string | null; page: string; metric_name: string; metric_value: number; rating?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string | null; page?: string; metric_name?: string; metric_value?: number; rating?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      backup_jobs: {
        Row: { id: string; backup_type: string; status: string; started_at: string | null; completed_at: string | null; location: string | null; checksum: string | null; notes: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; backup_type: string; status?: string; started_at?: string | null; completed_at?: string | null; location?: string | null; checksum?: string | null; notes?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; backup_type?: string; status?: string; started_at?: string | null; completed_at?: string | null; location?: string | null; checksum?: string | null; notes?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      market_benchmarks: {
        Row: { id: string; industry: string; region: string; metric_name: string; metric_value: number; metric_unit: string; sample_size: number; period: string; source: string; created_at: string; };
        Insert: { id?: string; industry: string; region?: string; metric_name: string; metric_value: number; metric_unit?: string; sample_size?: number; period?: string; source?: string; created_at?: string; };
        Update: { id?: string; industry?: string; region?: string; metric_name?: string; metric_value?: number; metric_unit?: string; sample_size?: number; period?: string; source?: string; created_at?: string; };
        Relationships: [];
      };
      subscription_plans: {
        Row: { id: string; code: 'free' | 'starter' | 'pro' | 'business' | 'enterprise'; name: string; monthly_price_ngn: number; target_users: string[]; features: Json; daily_free_voice_commands: number; daily_premium_voice_commands: number | null; daily_total_voice_commands: number | null; daily_snap_counts: number | null; is_unlimited_snap_count: boolean; max_products: number | null; max_devices: number | null; is_unlimited_voice: boolean; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; code: 'free' | 'starter' | 'pro' | 'business' | 'enterprise'; name: string; monthly_price_ngn?: number; target_users?: string[]; features?: Json; daily_free_voice_commands?: number; daily_premium_voice_commands?: number | null; daily_total_voice_commands?: number | null; daily_snap_counts?: number | null; is_unlimited_snap_count?: boolean; max_products?: number | null; max_devices?: number | null; is_unlimited_voice?: boolean; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; code?: 'free' | 'starter' | 'pro' | 'business' | 'enterprise'; name?: string; monthly_price_ngn?: number; target_users?: string[]; features?: Json; daily_free_voice_commands?: number; daily_premium_voice_commands?: number | null; daily_total_voice_commands?: number | null; daily_snap_counts?: number | null; is_unlimited_snap_count?: boolean; max_products?: number | null; max_devices?: number | null; is_unlimited_voice?: boolean; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      business_subscriptions: {
        Row: { id: string; business_id: string; plan_code: string; status: string; trial_started_at: string | null; trial_ends_at: string | null; current_period_started_at: string; current_period_ends_at: string | null; cancel_at_period_end: boolean; provider: string | null; provider_customer_id: string | null; provider_subscription_id: string | null; metadata: Json; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; plan_code: string; status?: string; trial_started_at?: string | null; trial_ends_at?: string | null; current_period_started_at?: string; current_period_ends_at?: string | null; cancel_at_period_end?: boolean; provider?: string | null; provider_customer_id?: string | null; provider_subscription_id?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; plan_code?: string; status?: string; trial_started_at?: string | null; trial_ends_at?: string | null; current_period_started_at?: string; current_period_ends_at?: string | null; cancel_at_period_end?: boolean; provider?: string | null; provider_customer_id?: string | null; provider_subscription_id?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      voice_ai_usage: {
        Row: { id: string; business_id: string; user_id: string; usage_date: string; free_commands_used: number; premium_commands_used: number; total_commands_used: number; last_command_at: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; user_id: string; usage_date?: string; free_commands_used?: number; premium_commands_used?: number; last_command_at?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string; usage_date?: string; free_commands_used?: number; premium_commands_used?: number; last_command_at?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      snap_count_usage: {
        Row: { id: string; business_id: string; user_id: string; usage_date: string; snap_counts_used: number; last_snap_at: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; user_id: string; usage_date?: string; snap_counts_used?: number; last_snap_at?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string; usage_date?: string; snap_counts_used?: number; last_snap_at?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      snap_count_reservations: {
        Row: { id: string; business_id: string; user_id: string; usage_date: string; status: string; expires_at: string; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; user_id: string; usage_date?: string; status?: string; expires_at?: string; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string; usage_date?: string; status?: string; expires_at?: string; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      voice_ai_commands: {
        Row: { id: string; business_id: string; user_id: string; command_text: string; normalized_text: string | null; intent: string; parsed_payload: Json; status: string; response_message: string | null; created_at: string; };
        Insert: { id?: string; business_id: string; user_id: string; command_text: string; normalized_text?: string | null; intent: string; parsed_payload?: Json; status?: string; response_message?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string; command_text?: string; normalized_text?: string | null; intent?: string; parsed_payload?: Json; status?: string; response_message?: string | null; created_at?: string; };
        Relationships: [];
      };
      billing_invoices: {
        Row: { id: string; business_id: string; subscription_id: string | null; invoice_number: string; amount: number; currency: string; status: string; provider: string | null; provider_reference: string | null; issued_at: string; paid_at: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; business_id: string; subscription_id?: string | null; invoice_number: string; amount?: number; currency?: string; status?: string; provider?: string | null; provider_reference?: string | null; issued_at?: string; paid_at?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string; subscription_id?: string | null; invoice_number?: string; amount?: number; currency?: string; status?: string; provider?: string | null; provider_reference?: string | null; issued_at?: string; paid_at?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      billing_receipts: {
        Row: { id: string; business_id: string; billing_invoice_id: string | null; receipt_number: string; amount: number; provider: string | null; provider_reference: string | null; receipt_payload: Json; created_at: string; };
        Insert: { id?: string; business_id: string; billing_invoice_id?: string | null; receipt_number: string; amount?: number; provider?: string | null; provider_reference?: string | null; receipt_payload?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string; billing_invoice_id?: string | null; receipt_number?: string; amount?: number; provider?: string | null; provider_reference?: string | null; receipt_payload?: Json; created_at?: string; };
        Relationships: [];
      };
      payment_provider_configs: {
        Row: { id: string; business_id: string | null; provider: string; public_config: Json; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id?: string | null; provider: string; public_config?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string | null; provider?: string; public_config?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      payment_requests: {
        Row: { id: string; business_id: string | null; user_id: string | null; plan_code: string; amount_ngn: number; provider: string; reference: string | null; proof_url: string | null; note: string | null; status: string; reviewed_by: string | null; reviewed_at: string | null; admin_note: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id?: string | null; user_id?: string | null; plan_code: string; amount_ngn?: number; provider?: string; reference?: string | null; proof_url?: string | null; note?: string | null; status?: string; reviewed_by?: string | null; reviewed_at?: string | null; admin_note?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string | null; user_id?: string | null; plan_code?: string; amount_ngn?: number; provider?: string; reference?: string | null; proof_url?: string | null; note?: string | null; status?: string; reviewed_by?: string | null; reviewed_at?: string | null; admin_note?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      collection_notes: {
        Row: { id: string; business_id: string; customer_id: string; invoice_id: string | null; note: string; priority: string; next_follow_up_at: string | null; created_by: string | null; created_at: string; };
        Insert: { id?: string; business_id: string; customer_id: string; invoice_id?: string | null; note: string; priority?: string; next_follow_up_at?: string | null; created_by?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string; customer_id?: string; invoice_id?: string | null; note?: string; priority?: string; next_follow_up_at?: string | null; created_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      report_schedules: {
        Row: { id: string; business_id: string; report_type: string; frequency: string; delivery_channel: string; recipient: string | null; is_active: boolean; last_sent_at: string | null; next_send_at: string | null; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; report_type: string; frequency?: string; delivery_channel?: string; recipient?: string | null; is_active?: boolean; last_sent_at?: string | null; next_send_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; report_type?: string; frequency?: string; delivery_channel?: string; recipient?: string | null; is_active?: boolean; last_sent_at?: string | null; next_send_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      ai_conversations: {
        Row: { id: string; business_id: string; user_id: string; title: string; category: string; is_pinned: boolean; is_favorite: boolean; is_archived: boolean; messages: Json; memory: Json; last_message_at: string; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; user_id: string; title?: string; category?: string; is_pinned?: boolean; is_favorite?: boolean; is_archived?: boolean; messages?: Json; memory?: Json; last_message_at?: string; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string; title?: string; category?: string; is_pinned?: boolean; is_favorite?: boolean; is_archived?: boolean; messages?: Json; memory?: Json; last_message_at?: string; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      business_memory: {
        Row: { id: string; business_id: string; memory_key: string; memory_value: Json; source: string; confidence: number; is_active: boolean; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; business_id: string; memory_key: string; memory_value?: Json; source?: string; confidence?: number; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; business_id?: string; memory_key?: string; memory_value?: Json; source?: string; confidence?: number; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      ai_agent_runs: {
        Row: { id: string; business_id: string; user_id: string | null; agent: string; prompt: string; response: Json; created_at: string; };
        Insert: { id?: string; business_id: string; user_id?: string | null; agent: string; prompt: string; response?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string; user_id?: string | null; agent?: string; prompt?: string; response?: Json; created_at?: string; };
        Relationships: [];
      };
      business_guardian_briefings: {
        Row: { id: string; business_id: string; briefing_type: string; title: string; summary: string; recommendations: Json; health_score: number; source: Json; created_at: string; };
        Insert: { id?: string; business_id: string; briefing_type: string; title: string; summary: string; recommendations?: Json; health_score?: number; source?: Json; created_at?: string; };
        Update: { id?: string; business_id?: string; briefing_type?: string; title?: string; summary?: string; recommendations?: Json; health_score?: number; source?: Json; created_at?: string; };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          type: string;
          industry: string;
          location: string;
          currency: string;
          timezone: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          industry: string;
          location: string;
          currency: string;
          timezone: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          industry?: string;
          location?: string;
          currency?: string;
          timezone?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          business_id: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          business_id?: string | null;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          business_id?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          role: 'super_admin' | 'business_owner' | 'manager' | 'staff' | 'viewer';
          business_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          role?: 'super_admin' | 'business_owner' | 'manager' | 'staff' | 'viewer';
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          role?: 'super_admin' | 'business_owner' | 'manager' | 'staff' | 'viewer';
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          sku: string;
          category: string;
          description: string | null;
          cost_price: number;
          selling_price: number;
          quantity: number;
          reorder_level: number;
          supplier: string | null;
          barcode: string | null;
          images: string[] | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          sku: string;
          category: string;
          description?: string | null;
          cost_price: number;
          selling_price: number;
          quantity?: number;
          reorder_level?: number;
          supplier?: string | null;
          barcode?: string | null;
          images?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          sku?: string;
          category?: string;
          description?: string | null;
          cost_price?: number;
          selling_price?: number;
          quantity?: number;
          reorder_level?: number;
          supplier?: string | null;
          barcode?: string | null;
          images?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          invoice_number: string;
          subtotal: number;
          tax: number;
          discount: number;
          total: number;
          payment_method: string;
          status: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id?: string | null;
          invoice_number: string;
          subtotal: number;
          tax: number;
          discount: number;
          total: number;
          payment_method: string;
          status: string;
          created_at?: string;
          created_by: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string | null;
          invoice_number?: string;
          subtotal?: number;
          tax?: number;
          discount?: number;
          total?: number;
          payment_method?: string;
          status?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount: number;
          total: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount: number;
          total: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          total?: number;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          credit_limit: number;
          current_balance: number;
          total_purchases: number;
          last_purchase_date: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          credit_limit?: number;
          current_balance?: number;
          total_purchases?: number;
          last_purchase_date?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          credit_limit?: number;
          current_balance?: number;
          total_purchases?: number;
          last_purchase_date?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          sale_id: string | null;
          invoice_number: string;
          subtotal: number;
          tax: number;
          discount: number;
          total: number;
          amount_paid: number;
          balance: number;
          due_date: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          sale_id: string | null;
          invoice_number: string;
          subtotal: number;
          tax: number;
          discount: number;
          total: number;
          amount_paid?: number;
          balance: number;
          due_date: string;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          sale_id?: string | null;
          invoice_number?: string;
          subtotal?: number;
          tax?: number;
          discount?: number;
          total?: number;
          amount_paid?: number;
          balance?: number;
          due_date?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: { id: string; business_id: string; product_id: string; warehouse_id: string | null; batch_id: string | null; type: string; quantity: number; unit_cost: number; reference_type: string | null; reference_id: string | null; notes: string | null; created_by: string | null; created_at: string; };
        Insert: { id?: string; business_id: string; product_id: string; warehouse_id?: string | null; batch_id?: string | null; type: string; quantity: number; unit_cost?: number; reference_type?: string | null; reference_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string; product_id?: string; warehouse_id?: string | null; batch_id?: string | null; type?: string; quantity?: number; unit_cost?: number; reference_type?: string | null; reference_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      pos_receipts: {
        Row: { id: string; business_id: string; sale_id: string; receipt_number: string; receipt_payload: Json; printed_at: string | null; emailed_at: string | null; created_at: string; };
        Insert: { id?: string; business_id: string; sale_id: string; receipt_number: string; receipt_payload?: Json; printed_at?: string | null; emailed_at?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string; sale_id?: string; receipt_number?: string; receipt_payload?: Json; printed_at?: string | null; emailed_at?: string | null; created_at?: string; };
        Relationships: [];
      };
      pos_returns: {
        Row: { id: string; business_id: string; sale_id: string; product_id: string | null; quantity: number; amount: number; reason: string; refund_method: string; status: string; created_by: string | null; created_at: string; };
        Insert: { id?: string; business_id: string; sale_id: string; product_id?: string | null; quantity: number; amount?: number; reason: string; refund_method?: string; status?: string; created_by?: string | null; created_at?: string; };
        Update: { id?: string; business_id?: string; sale_id?: string; product_id?: string | null; quantity?: number; amount?: number; reason?: string; refund_method?: string; status?: string; created_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          invoice_id: string;
          customer_id: string;
          amount: number;
          method: string;
          reference: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          invoice_id: string;
          customer_id: string;
          amount: number;
          method: string;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          invoice_id?: string;
          customer_id?: string;
          amount?: number;
          method?: string;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          business_id: string;
          type: string;
          severity: string;
          title: string;
          message: string;
          is_read: boolean;
          action_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type: string;
          severity: string;
          title: string;
          message: string;
          is_read?: boolean;
          action_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: string;
          severity?: string;
          title?: string;
          message?: string;
          is_read?: boolean;
          action_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      action_cards: {
        Row: {
          id: string;
          business_id: string;
          type: string;
          title: string;
          description: string;
          priority: number;
          completed: boolean;
          due_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type: string;
          title: string;
          description: string;
          priority: number;
          completed?: boolean;
          due_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: string;
          title?: string;
          description?: string;
          priority?: number;
          completed?: boolean;
          due_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          business_id: string;
          product_id: string;
          type: string;
          quantity: number;
          reason: string;
          reference: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          product_id: string;
          type: string;
          quantity: number;
          reason: string;
          reference?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          product_id?: string;
          type?: string;
          quantity?: number;
          reason?: string;
          reference?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      ensure_user_profile: {
        Args: {
          p_business_id?: string | null;
          p_name?: string | null;
          p_business_name?: string | null;
          p_industry?: string | null;
        };
        Returns: Database['public']['Tables']['users']['Row'];
      };
      ensure_user_profile_for_auth_user: {
        Args: {
          p_user_id: string;
          p_business_id?: string | null;
          p_name?: string | null;
          p_business_name?: string | null;
          p_industry?: string | null;
        };
        Returns: Database['public']['Tables']['users']['Row'];
      };
      resolve_profile_business_id: {
        Args: {
          p_business_id?: string | null;
          p_business_name?: string | null;
          p_industry?: string | null;
        };
        Returns: string | null;
      };
      safe_uuid: {
        Args: { value?: string | null };
        Returns: string | null;
      };
      upsert_business_memory: { Args: { target_business_id: string; target_memory_key: string; target_memory_value: Json; target_source?: string; target_confidence?: number }; Returns: Database['public']['Tables']['business_memory']['Row']; };
      reverse_payment: { Args: { payment_id: string; reversal_note?: string | null }; Returns: Database['public']['Tables']['payments']['Row']; };
      get_business_subscription: { Args: { target_business_id: string }; Returns: { business_id: string; plan_code: string; plan_name: string; status: string; monthly_price_ngn: number; daily_free_voice_commands: number; daily_premium_voice_commands: number | null; daily_total_voice_commands: number | null; is_unlimited_voice: boolean; max_products: number | null; max_devices: number | null; current_period_ends_at: string | null }[]; };
      get_snap_count_usage_status: { Args: { target_business_id: string }; Returns: { business_id: string; plan_code: string; plan_name: string; used_today: number; remaining_today: number | null; daily_limit: number | null; is_unlimited: boolean; reset_at: string; upgrade_message: string }[]; };
      reserve_snap_count: { Args: { target_business_id: string }; Returns: { allowed: boolean; reservation_id: string | null; plan_code: string; used_today: number; remaining_today: number | null; daily_limit: number | null; is_unlimited: boolean; message: string }[]; };
      commit_snap_count: { Args: { target_reservation_id: string }; Returns: boolean; };
      release_snap_count: { Args: { target_reservation_id: string }; Returns: boolean; };
      get_voice_ai_usage_status: { Args: { target_business_id: string }; Returns: { business_id: string; plan_code: string; plan_name: string; used_today: number; remaining_today: number | null; daily_limit: number | null; is_unlimited: boolean; reset_at: string; upgrade_message: string }[]; };
      parse_voice_ai_intent: { Args: { command_text: string }; Returns: Json; };
      record_voice_ai_command: { Args: { target_business_id: string; command_text: string }; Returns: { allowed: boolean; plan_code: string; used_today: number; remaining_today: number | null; daily_limit: number | null; is_unlimited: boolean; message: string; parsed_payload: Json }[]; };
      change_business_subscription: { Args: { target_business_id: string; target_plan_code: string; target_provider?: string }; Returns: Database['public']['Tables']['business_subscriptions']['Row']; };
      admin_list_users: { Args: Record<PropertyKey, never>; Returns: { id: string; email: string; name: string; business_id: string | null; role: string; created_at: string }[]; };
      admin_list_payment_requests: { Args: Record<PropertyKey, never>; Returns: (Database['public']['Tables']['payment_requests']['Row'] & { user_name: string | null; user_email: string | null; business_name: string | null })[]; };
      admin_review_payment_request: { Args: { p_request_id: string; p_decision: string; p_admin_note?: string | null }; Returns: Database['public']['Tables']['payment_requests']['Row']; };
      create_payment_request: { Args: { p_business_id: string; p_plan_code: string; p_amount_ngn: number; p_provider?: string; p_reference?: string | null; p_proof_url?: string | null; p_note?: string | null }; Returns: Database['public']['Tables']['payment_requests']['Row']; };

      repair_current_auth_business_link: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['businesses']['Row'];
      };
      repair_auth_business_link_for_user: {
        Args: { target_user_id: string };
        Returns: Database['public']['Tables']['businesses']['Row'];
      };
      ensure_business_for_current_user: {
        Args: {
          p_business_name?: string | null;
          p_industry?: string | null;
        };
        Returns: Database['public']['Tables']['businesses']['Row'];
      };
      ensure_profile_for_auth_user: {
        Args: {
          p_user_id: string;
          p_business_id?: string | null;
          p_full_name?: string | null;
          p_business_name?: string | null;
          p_industry?: string | null;
          p_phone?: string | null;
          p_avatar_url?: string | null;
        };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      current_profile_role: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      has_business_role: {
        Args: {
          target_business_id: string;
          allowed_roles: string[];
        };
        Returns: boolean;
      };
      generate_sku: { Args: { target_business_id: string; product_category?: string | null }; Returns: string; };
      record_inventory_transaction: { Args: { p_business_id: string; p_product_id: string; p_type: string; p_quantity: number; p_notes?: string | null; p_warehouse_id?: string | null; p_batch_id?: string | null; p_reference_type?: string | null; p_reference_id?: string | null; p_unit_cost?: number; }; Returns: string; };
      check_rate_limit: { Args: { p_key: string; p_limit?: number; p_window_seconds?: number }; Returns: boolean; };
      create_pos_sale: {
        Args: {
          p_business_id: string;
          p_customer_id?: string | null;
          p_payment_method?: string;
          p_discount?: number;
          p_tax?: number;
          p_due_date?: string | null;
          p_items?: Json;
        };
        Returns: string;
      };
    };
    Enums: {};
  };
}
