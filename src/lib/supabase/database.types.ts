// Hand-maintained mirror of supabase/migrations/*.sql.
// Regenerate with `supabase gen types typescript` once a live project exists,
// then reconcile with any additive changes made here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlatformRole = "user" | "super_admin";
export type WorkspaceRole = "owner" | "admin" | "member";

export type AgentStatus = "draft" | "active" | "inactive";
export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "stopped" | "error";
export type ContactStatus =
  | "new" | "queued" | "calling" | "connected" | "qualified" | "appointment_booked"
  | "follow_up" | "not_interested" | "no_answer" | "busy" | "voicemail"
  | "wrong_number" | "do_not_call" | "failed";
export type CallStatus =
  | "queued" | "initiated" | "ringing" | "in_progress" | "completed" | "busy"
  | "no_answer" | "failed" | "canceled" | "voicemail";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show" | "rescheduled";
export type CampaignContactStatus = "pending" | "queued" | "in_progress" | "completed" | "skipped" | "do_not_call";
export type IntegrationType = "twilio" | "openai" | "google_calendar" | "smtp" | "webhook" | "crm";
export type IntegrationStatus = "connected" | "not_connected" | "error";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          platform_role: PlatformRole;
          status: "active" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          plan: string;
          limits: Json;
          settings: Json;
          status: "active" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workspaces"]["Row"]> & { name: string; slug: string; owner_id: string };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Row"]>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          invited_at: string;
          joined_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["workspace_members"]["Row"]> & {
          workspace_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Row"]>;
        Relationships: [];
      };
      phone_numbers: {
        Row: {
          id: string;
          workspace_id: string;
          phone_number: string;
          friendly_name: string | null;
          twilio_sid: string | null;
          country: string | null;
          capabilities: Json;
          status: "active" | "inactive" | "error";
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["phone_numbers"]["Row"]> & {
          workspace_id: string;
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["phone_numbers"]["Row"]>;
        Relationships: [];
      };
      knowledge_bases: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["knowledge_bases"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_bases"]["Row"]>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          knowledge_base_id: string;
          workspace_id: string;
          name: string;
          source_type: "text" | "file" | "url";
          source_url: string | null;
          storage_path: string | null;
          mime_type: string | null;
          status: "pending" | "processing" | "ready" | "error";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["knowledge_documents"]["Row"]> & {
          knowledge_base_id: string;
          workspace_id: string;
          name: string;
          source_type: "text" | "file" | "url";
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_documents"]["Row"]>;
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          knowledge_base_id: string;
          workspace_id: string;
          chunk_index: number;
          content: string;
          token_count: number | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Row"]> & {
          document_id: string;
          knowledge_base_id: string;
          workspace_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Row"]>;
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          company_name: string | null;
          agent_role: string | null;
          persona: string | null;
          primary_objective: string | null;
          opening_greeting: string | null;
          system_prompt: string | null;
          conversation_instructions: string | null;
          qualification_questions: Json;
          objection_handling: string | null;
          closing_instructions: string | null;
          voicemail_message: string | null;
          language: string;
          accent: string | null;
          voice: string;
          response_length: "concise" | "balanced" | "detailed";
          creativity: number;
          interruptions_enabled: boolean;
          appointment_booking_enabled: boolean;
          call_transfer_enabled: boolean;
          transfer_phone_number: string | null;
          max_call_duration_seconds: number;
          silence_timeout_seconds: number;
          end_call_rules: string | null;
          status: AgentStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agents"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Row"]>;
        Relationships: [];
      };
      agent_knowledge_bases: {
        Row: { agent_id: string; knowledge_base_id: string };
        Insert: { agent_id: string; knowledge_base_id: string };
        Update: Partial<{ agent_id: string; knowledge_base_id: string }>;
        Relationships: [];
      };
      agent_versions: {
        Row: {
          id: string;
          agent_id: string;
          workspace_id: string;
          snapshot: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_versions"]["Row"]> & {
          agent_id: string;
          workspace_id: string;
          snapshot: Json;
        };
        Update: Partial<Database["public"]["Tables"]["agent_versions"]["Row"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          phone: string;
          email: string | null;
          website: string | null;
          job_title: string | null;
          timezone: string | null;
          country: string | null;
          industry: string | null;
          custom_fields: Json;
          status: ContactStatus;
          lead_score: number;
          owner_id: string | null;
          last_called_at: string | null;
          next_attempt_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contacts"]["Row"]> & {
          workspace_id: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
      contact_notes: {
        Row: {
          id: string;
          contact_id: string;
          workspace_id: string;
          author_id: string | null;
          note: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contact_notes"]["Row"]> & {
          contact_id: string;
          workspace_id: string;
          note: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_notes"]["Row"]>;
        Relationships: [];
      };
      do_not_call: {
        Row: {
          id: string;
          workspace_id: string;
          phone: string;
          reason: string | null;
          source_call_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["do_not_call"]["Row"]> & {
          workspace_id: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["do_not_call"]["Row"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          workspace_id: string;
          agent_id: string;
          phone_number_id: string | null;
          name: string;
          description: string | null;
          status: CampaignStatus;
          timezone_mode: "contact_local" | "fixed";
          fixed_timezone: string | null;
          days_of_week: number[];
          calling_start_time: string;
          calling_end_time: string;
          start_date: string | null;
          end_date: string | null;
          daily_call_limit: number;
          concurrency_limit: number;
          max_attempts: number;
          retry_no_answer_minutes: number;
          retry_busy_minutes: number;
          retry_failed_minutes: number;
          retry_excluded_statuses: string[];
          voicemail_action: "hang_up" | "leave_message";
          created_by: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaigns"]["Row"]> & {
          workspace_id: string;
          agent_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Row"]>;
        Relationships: [];
      };
      campaign_schedules: {
        Row: { id: string; campaign_id: string; day_of_week: number; start_time: string; end_time: string };
        Insert: Partial<Database["public"]["Tables"]["campaign_schedules"]["Row"]> & {
          campaign_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_schedules"]["Row"]>;
        Relationships: [];
      };
      campaign_contacts: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          workspace_id: string;
          status: CampaignContactStatus;
          attempts: number;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          added_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaign_contacts"]["Row"]> & {
          campaign_id: string;
          contact_id: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_contacts"]["Row"]>;
        Relationships: [];
      };
      campaign_attempts: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          call_id: string | null;
          attempt_number: number;
          outcome: string | null;
          attempted_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaign_attempts"]["Row"]> & {
          campaign_id: string;
          contact_id: string;
          attempt_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_attempts"]["Row"]>;
        Relationships: [];
      };
      calendar_connections: {
        Row: {
          id: string;
          workspace_id: string;
          provider: "google" | "outlook" | "calendly";
          email: string | null;
          calendar_id: string | null;
          access_token_ciphertext: string | null;
          refresh_token_ciphertext: string | null;
          token_iv: string | null;
          expires_at: string | null;
          status: "connected" | "expired" | "error" | "disconnected";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["calendar_connections"]["Row"]> & {
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_connections"]["Row"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          workspace_id: string;
          contact_id: string;
          campaign_id: string | null;
          agent_id: string | null;
          call_id: string | null;
          calendar_connection_id: string | null;
          title: string;
          starts_at: string;
          ends_at: string;
          timezone: string;
          status: AppointmentStatus;
          external_event_id: string | null;
          created_from_call: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          workspace_id: string;
          contact_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [];
      };
      callbacks: {
        Row: {
          id: string;
          workspace_id: string;
          contact_id: string;
          campaign_id: string | null;
          agent_id: string | null;
          requested_for: string;
          timezone: string;
          status: "scheduled" | "completed" | "cancelled" | "missed";
          created_from_call_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["callbacks"]["Row"]> & {
          workspace_id: string;
          contact_id: string;
          requested_for: string;
        };
        Update: Partial<Database["public"]["Tables"]["callbacks"]["Row"]>;
        Relationships: [];
      };
      calls: {
        Row: {
          id: string;
          workspace_id: string;
          campaign_id: string | null;
          agent_id: string | null;
          contact_id: string | null;
          phone_number_id: string | null;
          twilio_call_sid: string | null;
          twilio_stream_sid: string | null;
          openai_session_id: string | null;
          direction: "outbound" | "inbound";
          status: CallStatus;
          outcome: string | null;
          duration_seconds: number | null;
          recording_url: string | null;
          recording_sid: string | null;
          summary: string | null;
          qualification: Json | null;
          sentiment: string | null;
          interest_level: string | null;
          appointment_id: string | null;
          cost_cents: number | null;
          error_message: string | null;
          started_at: string | null;
          answered_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["calls"]["Row"]> & { workspace_id: string };
        Update: Partial<Database["public"]["Tables"]["calls"]["Row"]>;
        Relationships: [];
      };
      call_turns: {
        Row: {
          id: string;
          call_id: string;
          turn_number: number;
          speaker: "caller" | "agent";
          caller_speech_started_at: string | null;
          caller_speech_ended_at: string | null;
          turn_detection_latency_ms: number | null;
          model_latency_ms: number | null;
          first_audio_latency_ms: number | null;
          tool_latency_ms: number | null;
          total_turn_latency_ms: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["call_turns"]["Row"]> & {
          call_id: string;
          turn_number: number;
          speaker: "caller" | "agent";
        };
        Update: Partial<Database["public"]["Tables"]["call_turns"]["Row"]>;
        Relationships: [];
      };
      call_transcripts: {
        Row: {
          id: string;
          call_id: string;
          workspace_id: string;
          turn_number: number;
          speaker: "caller" | "agent" | "system";
          message: string;
          spoken_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["call_transcripts"]["Row"]> & {
          call_id: string;
          workspace_id: string;
          turn_number: number;
          speaker: "caller" | "agent" | "system";
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_transcripts"]["Row"]>;
        Relationships: [];
      };
      call_recordings: {
        Row: {
          id: string;
          call_id: string;
          workspace_id: string;
          twilio_recording_sid: string | null;
          storage_path: string | null;
          url: string | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["call_recordings"]["Row"]> & {
          call_id: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_recordings"]["Row"]>;
        Relationships: [];
      };
      call_events: {
        Row: {
          id: string;
          call_id: string;
          workspace_id: string;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["call_events"]["Row"]> & {
          call_id: string;
          workspace_id: string;
          event_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_events"]["Row"]>;
        Relationships: [];
      };
      call_tool_calls: {
        Row: {
          id: string;
          call_id: string;
          workspace_id: string;
          tool_name: string;
          arguments: Json;
          result: Json | null;
          status: "pending" | "success" | "error";
          latency_ms: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["call_tool_calls"]["Row"]> & {
          call_id: string;
          workspace_id: string;
          tool_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_tool_calls"]["Row"]>;
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          workspace_id: string | null;
          type: IntegrationType;
          status: IntegrationStatus;
          config: Json;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["integrations"]["Row"]> & {
          type: IntegrationType;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Row"]>;
        Relationships: [];
      };
      integration_credentials: {
        Row: {
          id: string;
          scope: "platform" | "workspace";
          workspace_id: string | null;
          provider: "openai" | "twilio" | "google" | "smtp" | "webhook";
          key_name: string;
          ciphertext: string;
          iv: string;
          last4: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["integration_credentials"]["Row"]> & {
          scope: "platform" | "workspace";
          provider: "openai" | "twilio" | "google" | "smtp" | "webhook";
          key_name: string;
          ciphertext: string;
          iv: string;
        };
        Update: Partial<Database["public"]["Tables"]["integration_credentials"]["Row"]>;
        Relationships: [];
      };
      webhooks: {
        Row: {
          id: string;
          workspace_id: string;
          url: string;
          secret_ciphertext: string | null;
          secret_iv: string | null;
          events: string[];
          status: "active" | "disabled";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["webhooks"]["Row"]> & {
          workspace_id: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["webhooks"]["Row"]>;
        Relationships: [];
      };
      usage_records: {
        Row: {
          id: string;
          workspace_id: string;
          period_date: string;
          calls_count: number;
          connected_calls_count: number;
          call_seconds: number;
          ai_audio_input_seconds: number;
          ai_audio_output_seconds: number;
          openai_tokens: number;
          twilio_minutes: number;
          recordings_count: number;
          storage_bytes: number;
          tool_calls_count: number;
          appointments_count: number;
          estimated_cost_cents: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["usage_records"]["Row"]> & {
          workspace_id: string;
          period_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_records"]["Row"]>;
        Relationships: [];
      };
      pricing_settings: {
        Row: { id: string; provider: string; unit: string; unit_cost_micros: number; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["pricing_settings"]["Row"]> & {
          provider: string;
          unit: string;
          unit_cost_micros: number;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_settings"]["Row"]>;
        Relationships: [];
      };
      system_settings: {
        Row: { id: string; key: string; value: Json; updated_at: string; updated_by: string | null };
        Insert: Partial<Database["public"]["Tables"]["system_settings"]["Row"]> & {
          key: string;
          value: Json;
        };
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Row"]>;
        Relationships: [];
      };
      feature_flags: {
        Row: { id: string; key: string; enabled: boolean; description: string | null; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["feature_flags"]["Row"]> & { key: string };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Row"]>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["admin_audit_logs"]["Row"]> & { action: string };
        Update: Partial<Database["public"]["Tables"]["admin_audit_logs"]["Row"]>;
        Relationships: [];
      };
      impersonation_sessions: {
        Row: {
          id: string;
          admin_id: string;
          target_user_id: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["impersonation_sessions"]["Row"]> & {
          admin_id: string;
          target_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["impersonation_sessions"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string | null;
          user_id: string | null;
          type: string;
          title: string;
          body: string | null;
          metadata: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          type: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      is_workspace_member: { Args: { target_workspace_id: string }; Returns: boolean };
      is_workspace_admin: { Args: { target_workspace_id: string }; Returns: boolean };
    };
    Enums: {
      platform_role: PlatformRole;
      workspace_role: WorkspaceRole;
    };
  };
}
