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
      agent_call_sessions: {
        Row: {
          agent_id: string
          contact_id: string | null
          ended_at: string | null
          exotel_call_sid: string | null
          id: string
          org_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          agent_id: string
          contact_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string | null
          id?: string
          org_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          contact_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string | null
          id?: string
          org_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_call_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_call_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_usage_logs: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: unknown | null
          method: string
          org_id: string
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          method: string
          org_id: string
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          method?: string
          org_id?: string
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_name: string
          key_prefix: string
          last_used_at: string | null
          org_id: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          key_prefix: string
          last_used_at?: string | null
          org_id: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          org_id?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rules: {
        Row: {
          approval_type_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          required_roles: string[]
          threshold_amount: number | null
          updated_at: string
        }
        Insert: {
          approval_type_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          required_roles?: string[]
          threshold_amount?: number | null
          updated_at?: string
        }
        Update: {
          approval_type_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          required_roles?: string[]
          threshold_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_rules_approval_type_id_fkey"
            columns: ["approval_type_id"]
            isOneToOne: false
            referencedRelation: "approval_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_dispositions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          activity_id: string | null
          agent_id: string | null
          answered_at: string | null
          call_duration: number | null
          call_type: string
          contact_id: string | null
          conversation_duration: number | null
          created_at: string | null
          direction: string
          disposition_id: string | null
          ended_at: string | null
          exotel_call_sid: string
          exotel_conversation_uuid: string | null
          exotel_raw_data: Json | null
          from_number: string
          id: string
          notes: string | null
          org_id: string
          recording_duration: number | null
          recording_url: string | null
          ring_duration: number | null
          started_at: string | null
          status: string
          sub_disposition_id: string | null
          to_number: string
        }
        Insert: {
          activity_id?: string | null
          agent_id?: string | null
          answered_at?: string | null
          call_duration?: number | null
          call_type: string
          contact_id?: string | null
          conversation_duration?: number | null
          created_at?: string | null
          direction: string
          disposition_id?: string | null
          ended_at?: string | null
          exotel_call_sid: string
          exotel_conversation_uuid?: string | null
          exotel_raw_data?: Json | null
          from_number: string
          id?: string
          notes?: string | null
          org_id: string
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          started_at?: string | null
          status: string
          sub_disposition_id?: string | null
          to_number: string
        }
        Update: {
          activity_id?: string | null
          agent_id?: string | null
          answered_at?: string | null
          call_duration?: number | null
          call_type?: string
          contact_id?: string | null
          conversation_duration?: number | null
          created_at?: string | null
          direction?: string
          disposition_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string
          exotel_conversation_uuid?: string | null
          exotel_raw_data?: Json | null
          from_number?: string
          id?: string
          notes?: string | null
          org_id?: string
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          started_at?: string | null
          status?: string
          sub_disposition_id?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "contact_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_sub_disposition_id_fkey"
            columns: ["sub_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_sub_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sub_dispositions: {
        Row: {
          created_at: string | null
          description: string | null
          disposition_id: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          disposition_id: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          disposition_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sub_dispositions_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sub_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_analytics: {
        Row: {
          bounce_count: number | null
          campaign_id: string
          campaign_type: string
          click_count: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          date: string
          id: string
          open_count: number | null
          org_id: string
          revenue: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          bounce_count?: number | null
          campaign_id: string
          campaign_type: string
          click_count?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date: string
          id?: string
          open_count?: number | null
          org_id: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          bounce_count?: number | null
          campaign_id?: string
          campaign_type?: string
          click_count?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date?: string
          id?: string
          open_count?: number | null
          org_id?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_insights: {
        Row: {
          analysis: string | null
          campaign_id: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          impact: string | null
          insight_type: string
          org_id: string
          priority: string
          status: string | null
          suggested_action: string | null
          supporting_data: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          analysis?: string | null
          campaign_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impact?: string | null
          insight_type: string
          org_id: string
          priority: string
          status?: string | null
          suggested_action?: string | null
          supporting_data?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          analysis?: string | null
          campaign_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impact?: string | null
          insight_type?: string
          org_id?: string
          priority?: string
          status?: string | null
          suggested_action?: string | null
          supporting_data?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          approved_at: string | null
          buttons: Json | null
          category: string | null
          content: string
          created_at: string | null
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string | null
          last_synced_at: string | null
          org_id: string
          rejection_reason: string | null
          sample_values: Json | null
          status: string | null
          submission_status: string | null
          submitted_at: string | null
          template_id: string
          template_name: string
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          approved_at?: string | null
          buttons?: Json | null
          category?: string | null
          content: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          org_id: string
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          template_id: string
          template_name: string
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          approved_at?: string | null
          buttons?: Json | null
          category?: string | null
          content?: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          org_id?: string
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          template_id?: string
          template_name?: string
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_logs: {
        Row: {
          contact_id: string | null
          created_at: string | null
          error_message: string | null
          form_id: string | null
          http_status_code: number
          id: string
          ip_address: unknown | null
          org_id: string
          request_id: string
          request_payload: Json
          response_payload: Json | null
          status: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          http_status_code: number
          id?: string
          ip_address?: unknown | null
          org_id: string
          request_id: string
          request_payload?: Json
          response_payload?: Json | null
          status: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          http_status_code?: number
          id?: string
          ip_address?: unknown | null
          org_id?: string
          request_id?: string
          request_payload?: Json
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_logs_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activities: {
        Row: {
          activity_type: string
          call_disposition_id: string | null
          call_duration: number | null
          call_sub_disposition_id: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          completed_at: string | null
          contact_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location_accuracy: number | null
          org_id: string
          scheduled_at: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          call_disposition_id?: string | null
          call_duration?: number | null
          call_sub_disposition_id?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location_accuracy?: number | null
          org_id: string
          scheduled_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          call_disposition_id?: string | null
          call_duration?: number | null
          call_sub_disposition_id?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location_accuracy?: number | null
          org_id?: string
          scheduled_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_call_disposition_id_fkey"
            columns: ["call_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_call_sub_disposition_id_fkey"
            columns: ["call_sub_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_sub_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_fields: {
        Row: {
          contact_id: string
          created_at: string
          custom_field_id: string
          field_value: string | null
          id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          custom_field_id: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          custom_field_id?: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_fields_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          email_type: string
          id: string
          is_primary: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          email: string
          email_type?: string
          id?: string
          is_primary?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          email_type?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          org_id: string
          phone: string
          phone_type: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id: string
          phone: string
          phone_type?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          phone?: string
          phone_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          assigned_team_id: string | null
          assigned_to: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string | null
          last_verified_location_at: string | null
          latitude: number | null
          linkedin_url: string | null
          longitude: number | null
          notes: string | null
          org_id: string
          phone: string | null
          pipeline_stage_id: string | null
          postal_code: string | null
          referred_by: string | null
          source: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          assigned_team_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          last_verified_location_at?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          longitude?: number | null
          notes?: string | null
          org_id: string
          phone?: string | null
          pipeline_stage_id?: string | null
          postal_code?: string | null
          referred_by?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          assigned_team_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          last_verified_location_at?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          longitude?: number | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          pipeline_stage_id?: string | null
          postal_code?: string | null
          referred_by?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to_table: string
          created_at: string
          field_label: string
          field_name: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          org_id: string
          updated_at: string
        }
        Insert: {
          applies_to_table: string
          created_at?: string
          field_label: string
          field_name: string
          field_options?: Json | null
          field_order?: number
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          org_id: string
          updated_at?: string
        }
        Update: {
          applies_to_table?: string
          created_at?: string
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      designation_feature_access: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          custom_permissions: Json | null
          designation_id: string
          feature_key: string
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_permissions?: Json | null
          designation_id: string
          feature_key: string
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_permissions?: Json | null
          designation_id?: string
          feature_key?: string
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designation_feature_access_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designation_feature_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      email_bulk_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          html_content: string
          id: string
          name: string
          org_id: string
          pending_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject: string
          template_id: string | null
          total_recipients: number
          updated_at: string
          variable_mappings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content: string
          id?: string
          name: string
          org_id: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content?: string
          id?: string
          name?: string
          org_id?: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_bulk_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_bulk_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          custom_data: Json | null
          email: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          email: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          email?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_conversations: {
        Row: {
          attachments: Json | null
          bcc_emails: string[] | null
          cc_emails: string[] | null
          contact_id: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          email_content: string
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          html_content: string | null
          id: string
          is_read: boolean | null
          org_id: string
          provider_message_id: string | null
          read_at: string | null
          received_at: string | null
          replied_to_message_id: string | null
          reply_to_email: string | null
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          thread_id: string | null
          to_email: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          contact_id?: string | null
          conversation_id: string
          created_at?: string | null
          direction: string
          email_content: string
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          html_content?: string | null
          id?: string
          is_read?: boolean | null
          org_id: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string | null
          replied_to_message_id?: string | null
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          thread_id?: string | null
          to_email: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          contact_id?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          email_content?: string
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          html_content?: string | null
          id?: string
          is_read?: boolean | null
          org_id?: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string | null
          replied_to_message_id?: string | null
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          thread_id?: string | null
          to_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_conversations_replied_to_message_id_fkey"
            columns: ["replied_to_message_id"]
            isOneToOne: false
            referencedRelation: "email_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string | null
          dns_records: Json | null
          id: string
          inbound_route_id: string | null
          inbound_routing_enabled: boolean | null
          inbound_webhook_url: string | null
          is_active: boolean | null
          org_id: string
          resend_domain_id: string | null
          sending_domain: string
          updated_at: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          dns_records?: Json | null
          id?: string
          inbound_route_id?: string | null
          inbound_routing_enabled?: boolean | null
          inbound_webhook_url?: string | null
          is_active?: boolean | null
          org_id: string
          resend_domain_id?: string | null
          sending_domain: string
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          dns_records?: Json | null
          id?: string
          inbound_route_id?: string | null
          inbound_routing_enabled?: boolean | null
          inbound_webhook_url?: string | null
          is_active?: boolean | null
          org_id?: string
          resend_domain_id?: string | null
          sending_domain?: string
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          attachments: Json | null
          body_content: string | null
          buttons: Json | null
          created_at: string
          created_by: string | null
          design_json: Json | null
          html_content: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          design_json?: Json | null
          html_content?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          design_json?: Json | null
          html_content?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string
          error_type: string
          id: string
          org_id: string
          page_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message: string
          error_type: string
          id?: string
          org_id: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          org_id?: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exotel_settings: {
        Row: {
          account_sid: string
          api_key: string
          api_token: string
          call_recording_enabled: boolean | null
          caller_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          org_id: string
          subdomain: string
          updated_at: string | null
        }
        Insert: {
          account_sid: string
          api_key: string
          api_token: string
          call_recording_enabled?: boolean | null
          caller_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          subdomain?: string
          updated_at?: string | null
        }
        Update: {
          account_sid?: string
          api_key?: string
          api_token?: string
          call_recording_enabled?: boolean | null
          caller_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          subdomain?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exotel_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_permissions: {
        Row: {
          category: string
          created_at: string | null
          feature_description: string | null
          feature_key: string
          feature_name: string
          id: string
          is_premium: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          feature_description?: string | null
          feature_key: string
          feature_name: string
          id?: string
          is_premium?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          feature_description?: string | null
          feature_key?: string
          feature_name?: string
          id?: string
          is_premium?: boolean | null
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          created_at: string | null
          custom_field_id: string
          field_order: number
          form_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          custom_field_id: string
          field_order?: number
          form_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string
          field_order?: number
          form_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          connector_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          rate_limit_per_minute: number | null
          updated_at: string | null
          webhook_config: Json | null
          webhook_token: string | null
        }
        Insert: {
          connector_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_config?: Json | null
          webhook_token?: string | null
        }
        Update: {
          connector_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_config?: Json | null
          webhook_token?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_stage: string | null
          error_count: number | null
          error_details: Json | null
          file_cleaned_up: boolean | null
          file_cleanup_at: string | null
          file_name: string
          file_path: string
          id: string
          import_type: string
          org_id: string
          processed_rows: number | null
          stage_details: Json | null
          started_at: string | null
          status: string
          success_count: number | null
          target_id: string | null
          total_rows: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_stage?: string | null
          error_count?: number | null
          error_details?: Json | null
          file_cleaned_up?: boolean | null
          file_cleanup_at?: string | null
          file_name: string
          file_path: string
          id?: string
          import_type: string
          org_id: string
          processed_rows?: number | null
          stage_details?: Json | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          target_id?: string | null
          total_rows?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_stage?: string | null
          error_count?: number | null
          error_details?: Json | null
          file_cleaned_up?: boolean | null
          file_cleanup_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          import_type?: string
          org_id?: string
          processed_rows?: number | null
          stage_details?: Json | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          target_id?: string | null
          total_rows?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          available_qty: number
          batch_no: string | null
          brand: string | null
          category: string | null
          certificate_no: string | null
          created_at: string
          created_by: string | null
          customer_project: string | null
          date_of_entry: string | null
          diameter_mm: string | null
          discount_pct: number | null
          drive_type: string | null
          expiry_review_date: string | null
          finish_coating: string | null
          grade_class: string | null
          gst_pct: number | null
          head_type: string | null
          heat_no: string | null
          hsn_code: string | null
          id: string
          image_ref: string | null
          import_job_id: string | null
          inspection_status: string | null
          issued_to: string | null
          item_id_sku: string
          item_name: string | null
          last_purchase_date: string | null
          last_purchase_price: number | null
          last_sale_date: string | null
          lead_time_days: number | null
          length_mm: string | null
          material: string | null
          org_id: string
          purchase_order_no: string | null
          remarks_notes: string | null
          reorder_level: number | null
          reorder_qty: number | null
          selling_price: number | null
          standard_spec: string | null
          storage_location: string | null
          subcategory: string | null
          supplier_code: string | null
          supplier_name: string | null
          thread_pitch: string | null
          uom: string | null
          updated_at: string
          warehouse_branch: string | null
          weight_per_unit: number | null
        }
        Insert: {
          available_qty?: number
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          certificate_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_project?: string | null
          date_of_entry?: string | null
          diameter_mm?: string | null
          discount_pct?: number | null
          drive_type?: string | null
          expiry_review_date?: string | null
          finish_coating?: string | null
          grade_class?: string | null
          gst_pct?: number | null
          head_type?: string | null
          heat_no?: string | null
          hsn_code?: string | null
          id?: string
          image_ref?: string | null
          import_job_id?: string | null
          inspection_status?: string | null
          issued_to?: string | null
          item_id_sku: string
          item_name?: string | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          lead_time_days?: number | null
          length_mm?: string | null
          material?: string | null
          org_id: string
          purchase_order_no?: string | null
          remarks_notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          selling_price?: number | null
          standard_spec?: string | null
          storage_location?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          thread_pitch?: string | null
          uom?: string | null
          updated_at?: string
          warehouse_branch?: string | null
          weight_per_unit?: number | null
        }
        Update: {
          available_qty?: number
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          certificate_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_project?: string | null
          date_of_entry?: string | null
          diameter_mm?: string | null
          discount_pct?: number | null
          drive_type?: string | null
          expiry_review_date?: string | null
          finish_coating?: string | null
          grade_class?: string | null
          gst_pct?: number | null
          head_type?: string | null
          heat_no?: string | null
          hsn_code?: string | null
          id?: string
          image_ref?: string | null
          import_job_id?: string | null
          inspection_status?: string | null
          issued_to?: string | null
          item_id_sku?: string
          item_name?: string | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          lead_time_days?: number | null
          length_mm?: string | null
          material?: string | null
          org_id?: string
          purchase_order_no?: string | null
          remarks_notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          selling_price?: number | null
          standard_spec?: string | null
          storage_location?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          thread_pitch?: string | null
          uom?: string | null
          updated_at?: string
          warehouse_branch?: string | null
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_feature_access: {
        Row: {
          created_at: string | null
          disabled_at: string | null
          enabled_at: string | null
          feature_key: string
          id: string
          is_enabled: boolean | null
          modified_by: string | null
          notes: string | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled_at?: string | null
          enabled_at?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean | null
          modified_by?: string | null
          notes?: string | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled_at?: string | null
          enabled_at?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean | null
          modified_by?: string | null
          notes?: string | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_feature_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invite_code: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_cycle_start: string
          created_at: string | null
          grace_period_end: string | null
          id: string
          last_payment_date: string | null
          lockout_date: string | null
          monthly_subscription_amount: number
          next_billing_date: string
          one_time_setup_fee: number | null
          org_id: string
          override_by: string | null
          override_reason: string | null
          readonly_period_end: string | null
          subscription_status: string
          suspension_date: string | null
          suspension_override_until: string | null
          suspension_reason: string | null
          updated_at: string | null
          user_count: number
          wallet_auto_topup_enabled: boolean | null
          wallet_balance: number
          wallet_last_topup_date: string | null
          wallet_minimum_balance: number
        }
        Insert: {
          billing_cycle_start: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date: string
          one_time_setup_fee?: number | null
          org_id: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_minimum_balance?: number
        }
        Update: {
          billing_cycle_start?: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date?: string
          one_time_setup_fee?: number | null
          org_id?: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_minimum_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          services_enabled: boolean | null
          settings: Json | null
          slug: string
          subscription_active: boolean | null
          updated_at: string | null
          usage_limits: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          services_enabled?: boolean | null
          settings?: Json | null
          slug: string
          subscription_active?: boolean | null
          updated_at?: string | null
          usage_limits?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          services_enabled?: boolean | null
          settings?: Json | null
          slug?: string
          subscription_active?: boolean | null
          updated_at?: string | null
          usage_limits?: Json | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          initiated_by: string | null
          invoice_id: string | null
          metadata: Json | null
          org_id: string
          payment_method: string | null
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id?: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          probability: number | null
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          probability?: number | null
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          probability?: number | null
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_org_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_org_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_org_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_audit_log_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calling_enabled: boolean | null
          created_at: string | null
          designation_id: string | null
          email_enabled: boolean | null
          first_name: string | null
          id: string
          is_active: boolean
          is_platform_admin: boolean | null
          last_name: string | null
          onboarding_completed: boolean | null
          org_id: string | null
          phone: string | null
          sms_enabled: boolean | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          calling_enabled?: boolean | null
          created_at?: string | null
          designation_id?: string | null
          email_enabled?: boolean | null
          first_name?: string | null
          id: string
          is_active?: boolean
          is_platform_admin?: boolean | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          calling_enabled?: boolean | null
          created_at?: string | null
          designation_id?: string | null
          email_enabled?: boolean | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_platform_admin?: boolean | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown | null
          operation: string
          org_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          operation: string
          org_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          operation?: string
          org_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      redefine_data_repository: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          designation: string | null
          employee_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          generic_email: string | null
          id: string
          industry_type: string | null
          job_level: string | null
          linkedin_url: string | null
          location: string | null
          mobile_2: string | null
          mobile_number: string | null
          name: string
          official_email: string | null
          org_id: string
          personal_email: string | null
          pincode: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          updated_at: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          employee_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email?: string | null
          id?: string
          industry_type?: string | null
          job_level?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_2?: string | null
          mobile_number?: string | null
          name: string
          official_email?: string | null
          org_id: string
          personal_email?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          employee_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email?: string | null
          id?: string
          industry_type?: string | null
          job_level?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_2?: string | null
          mobile_number?: string | null
          name?: string
          official_email?: string | null
          org_id?: string
          personal_email?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redefine_data_repository_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      redefine_repository_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          repository_record_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          repository_record_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          repository_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redefine_repository_audit_repository_record_id_fkey"
            columns: ["repository_record_id"]
            isOneToOne: false
            referencedRelation: "redefine_data_repository"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_hierarchy: {
        Row: {
          created_at: string | null
          designation_id: string
          id: string
          org_id: string
          reports_to_designation_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          designation_id: string
          id?: string
          org_id: string
          reports_to_designation_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          designation_id?: string
          id?: string
          org_id?: string
          reports_to_designation_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reporting_hierarchy_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: true
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporting_hierarchy_reports_to_designation_id_fkey"
            columns: ["reports_to_designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          data_source: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          data_source: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_usage_logs: {
        Row: {
          cost: number
          created_at: string | null
          deduction_error: string | null
          id: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id: string | null
          wallet_deducted: boolean | null
          wallet_transaction_id: string | null
        }
        Insert: {
          cost: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id?: string
          quantity?: number
          reference_id?: string
          service_type?: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_usage_logs_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          performed_by: string
          reason: string
          target_record_id: string | null
          target_record_type: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          performed_by: string
          reason: string
          target_record_id?: string | null
          target_record_type?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          performed_by?: string
          reason?: string
          target_record_id?: string | null
          target_record_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          due_date: string
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_status: string
          prorated_amount: number | null
          setup_fee: number | null
          subtotal: number
          total_amount: number
          updated_at: string | null
          user_count: number
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          due_date: string
          gst_amount: number
          id?: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal: number
          total_amount: number
          updated_at?: string | null
          user_count: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          base_subscription_amount?: number
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          due_date?: string
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          org_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal?: number
          total_amount?: number
          updated_at?: string | null
          user_count?: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notifications: {
        Row: {
          created_at: string | null
          email_subject: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          notification_type: string
          org_id: string
          recipient_emails: string[]
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_subject: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notification_type: string
          org_id: string
          recipient_emails: string[]
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_subject?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notification_type?: string
          org_id?: string
          recipient_emails?: string[]
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_pricing: {
        Row: {
          auto_topup_amount: number
          auto_topup_enabled: boolean | null
          call_cost_per_call: number | null
          call_cost_per_minute: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          email_cost_per_unit: number
          gst_percentage: number
          id: string
          is_active: boolean | null
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          updated_at: string | null
          whatsapp_cost_per_unit: number
        }
        Insert: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Update: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          admin_reason: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          payment_transaction_id: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          admin_reason?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          admin_reason?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bulk_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          message_content: string
          name: string
          org_id: string
          pending_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          template_id: string | null
          total_recipients: number
          updated_at: string
          variable_mappings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          message_content: string
          name: string
          org_id: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          message_content?: string
          name?: string
          org_id?: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bulk_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          custom_data: Json | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          max_retries: number
          message_id: string | null
          next_retry_at: string | null
          phone_number: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          message_id?: string | null
          next_retry_at?: string | null
          phone_number: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          message_id?: string | null
          next_retry_at?: string | null
          phone_number?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          gupshup_message_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string
          org_id: string
          phone_number: string
          read_at: string | null
          replied_to_message_id: string | null
          scheduled_at: string | null
          sender_name: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          template_id: string | null
          template_variables: Json | null
        }
        Insert: {
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          gupshup_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content: string
          org_id: string
          phone_number: string
          read_at?: string | null
          replied_to_message_id?: string | null
          scheduled_at?: string | null
          sender_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
        }
        Update: {
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          gupshup_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          org_id?: string
          phone_number?: string
          read_at?: string | null
          replied_to_message_id?: string | null
          scheduled_at?: string | null
          sender_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_replied_to_message_id_fkey"
            columns: ["replied_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          app_name: string
          created_at: string | null
          gupshup_api_key: string
          id: string
          is_active: boolean | null
          org_id: string
          updated_at: string | null
          webhook_secret: string | null
          whatsapp_source_number: string
        }
        Insert: {
          app_name: string
          created_at?: string | null
          gupshup_api_key: string
          id?: string
          is_active?: boolean | null
          org_id: string
          updated_at?: string | null
          webhook_secret?: string | null
          whatsapp_source_number: string
        }
        Update: {
          app_name?: string
          created_at?: string | null
          gupshup_api_key?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
          whatsapp_source_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_monthly_amount: {
        Args: { _org_id: string }
        Returns: number
      }
      check_and_update_subscription_status: {
        Args: { _org_id: string }
        Returns: undefined
      }
      check_connector_rate_limit: {
        Args: { _form_id: string; _limit: number }
        Returns: boolean
      }
      cleanup_orphaned_profile: {
        Args: { user_id: string }
        Returns: undefined
      }
      create_default_call_dispositions: {
        Args: { _org_id: string }
        Returns: undefined
      }
      create_default_pipeline_stages: {
        Args: { _org_id: string }
        Returns: undefined
      }
      create_organization_for_user: {
        Args: { p_org_name: string; p_org_slug: string; p_user_id: string }
        Returns: string
      }
      deduct_from_wallet: {
        Args: {
          _amount: number
          _org_id: string
          _quantity: number
          _reference_id: string
          _service_type: string
          _unit_cost: number
          _user_id: string
        }
        Returns: Json
      }
      delete_user_data: {
        Args: { user_email: string }
        Returns: undefined
      }
      designation_has_feature_access: {
        Args: {
          _designation_id: string
          _feature_key: string
          _permission?: string
        }
        Returns: boolean
      }
      generate_api_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_unique_slug: {
        Args: { base_slug: string }
        Returns: string
      }
      generate_webhook_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_pricing: {
        Args: Record<PropertyKey, never>
        Returns: {
          auto_topup_amount: number
          call_cost_per_call: number
          call_cost_per_minute: number
          email_cost_per_unit: number
          gst_percentage: number
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          whatsapp_cost_per_unit: number
        }[]
      }
      get_orphaned_profiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_pipeline_performance_report: {
        Args: { p_org_id: string }
        Returns: {
          contact_count: number
          stage_color: string
          stage_id: string
          stage_name: string
          stage_order: number
        }[]
      }
      get_reporting_chain: {
        Args: { p_designation_id: string }
        Returns: {
          designation_id: string
          level: number
        }[]
      }
      get_sales_performance_report: {
        Args: { p_org_id: string; p_start_date: string }
        Returns: {
          conversion_rate: number
          deals_won: number
          total_calls: number
          total_contacts: number
          total_emails: number
          total_meetings: number
          user_id: string
          user_name: string
        }[]
      }
      get_subordinates: {
        Args: { p_designation_id: string }
        Returns: {
          designation_id: string
          level: number
        }[]
      }
      get_unified_inbox: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          channel: string
          contact_id: string
          contact_name: string
          conversation_id: string
          direction: string
          email_address: string
          id: string
          is_read: boolean
          phone_number: string
          preview: string
          sender_name: string
          sent_at: string
        }[]
      }
      get_user_org_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_campaign_stats: {
        Args: {
          p_campaign_id: string
          p_failed_increment?: number
          p_pending_increment?: number
          p_sent_increment?: number
        }
        Returns: undefined
      }
      increment_email_campaign_stats: {
        Args: {
          p_campaign_id: string
          p_failed_increment?: number
          p_pending_increment?: number
          p_sent_increment?: number
        }
        Returns: undefined
      }
      is_feature_enabled_for_org: {
        Args: { _feature_key: string; _org_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      trigger_retry_failed_whatsapp: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales_manager"
        | "sales_agent"
        | "support_manager"
        | "support_agent"
        | "analyst"
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
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "sales_manager",
        "sales_agent",
        "support_manager",
        "support_agent",
        "analyst",
      ],
    },
  },
} as const
