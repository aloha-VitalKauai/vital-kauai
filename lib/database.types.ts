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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adverse_events: {
        Row: {
          action_taken: string | null
          assessment_id: string | null
          ceremony_id: string | null
          classified_at: string | null
          classified_by: string | null
          created_at: string
          description: string
          dosing_record_id: string | null
          escalated_at: string | null
          escalated_to: string | null
          escalation_required: boolean | null
          event_type: string
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          member_id: string
          notifiable: boolean | null
          notified_at: string | null
          onset_date: string | null
          outcome_notes: string | null
          relatedness: string
          reported_at: string
          reported_by: string
          reporter_contact_at: string | null
          reporter_contact_made: boolean | null
          resolution_date: string | null
          resolution_status: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sequelae_description: string | null
          severity: string
          staff_notes: string | null
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          assessment_id?: string | null
          ceremony_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          description: string
          dosing_record_id?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_required?: boolean | null
          event_type: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          member_id: string
          notifiable?: boolean | null
          notified_at?: string | null
          onset_date?: string | null
          outcome_notes?: string | null
          relatedness?: string
          reported_at?: string
          reported_by?: string
          reporter_contact_at?: string | null
          reporter_contact_made?: boolean | null
          resolution_date?: string | null
          resolution_status?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sequelae_description?: string | null
          severity: string
          staff_notes?: string | null
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          assessment_id?: string | null
          ceremony_id?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          description?: string
          dosing_record_id?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_required?: boolean | null
          event_type?: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          member_id?: string
          notifiable?: boolean | null
          notified_at?: string | null
          onset_date?: string | null
          outcome_notes?: string | null
          relatedness?: string
          reported_at?: string
          reported_by?: string
          reporter_contact_at?: string | null
          reporter_contact_made?: boolean | null
          resolution_date?: string | null
          resolution_status?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sequelae_description?: string | null
          severity?: string
          staff_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_dosing_record_id_fkey"
            columns: ["dosing_record_id"]
            isOneToOne: false
            referencedRelation: "dosing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      assessment_scale_items: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          item_number: number
          item_value: number
          scale_name: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          item_number: number
          item_value: number
          scale_name: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          item_number?: number
          item_value?: number
          scale_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scale_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scale_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_scale_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_scale_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_window_config: {
        Row: {
          due_offset_days: number
          hard_close_offset_days: number
          label: string
          nominal_close_offset_days: number
          notes: string | null
          open_offset_days: number
          overdue_still_open: boolean
          sort_order: number
          timepoint: string
        }
        Insert: {
          due_offset_days: number
          hard_close_offset_days: number
          label: string
          nominal_close_offset_days: number
          notes?: string | null
          open_offset_days: number
          overdue_still_open?: boolean
          sort_order: number
          timepoint: string
        }
        Update: {
          due_offset_days?: number
          hard_close_offset_days?: number
          label?: string
          nominal_close_offset_days?: number
          notes?: string | null
          open_offset_days?: number
          overdue_still_open?: boolean
          sort_order?: number
          timepoint?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after_state: Json | null
          before_state: Json | null
          id: string
          metadata: Json
          occurred_at: string
          reason: string
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          metadata?: Json
          occurred_at?: string
          reason: string
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value_json: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value_json: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_due_cents: number | null
          amount_paid_cents: number
          booking_status: Database["public"]["Enums"]["booking_status"]
          created_at: string
          id: string
          journey_id: string | null
          member_id: string
          notes: string | null
          package_name: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          square_customer_id: string | null
          square_order_id: string | null
          square_payment_id: string | null
          square_payment_link_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number | null
          amount_paid_cents?: number
          booking_status?: Database["public"]["Enums"]["booking_status"]
          created_at?: string
          id?: string
          journey_id?: string | null
          member_id: string
          notes?: string | null
          package_name?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          square_customer_id?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number | null
          amount_paid_cents?: number
          booking_status?: Database["public"]["Enums"]["booking_status"]
          created_at?: string
          id?: string
          journey_id?: string | null
          member_id?: string
          notes?: string | null
          package_name?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          square_customer_id?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          square_payment_link_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          end_time: string
          event_date: string
          id: string
          is_private: boolean
          journey_id: string
          location: string | null
          notes: string | null
          sort_order: number
          source_template_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          end_time: string
          event_date: string
          id?: string
          is_private?: boolean
          journey_id: string
          location?: string | null
          notes?: string | null
          sort_order?: number
          source_template_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          end_time?: string
          event_date?: string
          id?: string
          is_private?: boolean
          journey_id?: string
          location?: string | null
          notes?: string | null
          sort_order?: number
          source_template_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "client_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      calendly_event_mappings: {
        Row: {
          active: boolean
          calendly_event_type_uri: string
          created_at: string
          id: string
          label: string | null
          session_type: string
        }
        Insert: {
          active?: boolean
          calendly_event_type_uri: string
          created_at?: string
          id?: string
          label?: string | null
          session_type: string
        }
        Update: {
          active?: boolean
          calendly_event_type_uri?: string
          created_at?: string
          id?: string
          label?: string | null
          session_type?: string
        }
        Relationships: []
      }
      ceremony_records: {
        Row: {
          ceremony_date: string | null
          ceremony_notes: string | null
          created_at: string | null
          guides_present: string | null
          id: string
          integration_calls: number | null
          journey_id: string | null
          medicine_form: string | null
          member_id: string
          post_notes: string | null
          pre_notes: string | null
          status: string | null
        }
        Insert: {
          ceremony_date?: string | null
          ceremony_notes?: string | null
          created_at?: string | null
          guides_present?: string | null
          id?: string
          integration_calls?: number | null
          journey_id?: string | null
          medicine_form?: string | null
          member_id: string
          post_notes?: string | null
          pre_notes?: string | null
          status?: string | null
        }
        Update: {
          ceremony_date?: string | null
          ceremony_notes?: string | null
          created_at?: string | null
          guides_present?: string | null
          id?: string
          integration_calls?: number | null
          journey_id?: string | null
          medicine_form?: string | null
          member_id?: string
          post_notes?: string | null
          pre_notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceremony_records_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "ceremony_records_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "ceremony_records_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceremony_records_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      client_journeys: {
        Row: {
          client_id: string | null
          color: string | null
          created_at: string
          display_name: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          color?: string | null
          created_at?: string
          display_name: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          color?: string | null
          created_at?: string
          display_name?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_journeys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      cohorts: {
        Row: {
          capacity: number | null
          created_at: string
          end_at: string | null
          id: string
          is_public: boolean
          location_id: string | null
          start_at: string
          status: string
          suggested_price_cents: number | null
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          end_at?: string | null
          id?: string
          is_public?: boolean
          location_id?: string | null
          start_at: string
          status?: string
          suggested_price_cents?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          end_at?: string | null
          id?: string
          is_public?: boolean
          location_id?: string | null
          start_at?: string
          status?: string
          suggested_price_cents?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dosing_records: {
        Row: {
          administered_at: string
          administered_by: string | null
          adverse_events: string | null
          batch_id: string | null
          bp_diastolic_at_onset: number | null
          bp_systolic_at_onset: number | null
          ceremony_id: string | null
          created_at: string
          dose_g: number
          dose_g_consult_high: number | null
          dose_g_consult_low: number | null
          dose_g_deep_high: number | null
          dose_g_deep_low: number | null
          dose_g_flood_high: number | null
          dose_g_flood_low: number | null
          dose_g_flood_mid: number | null
          dose_g_integration_high: number | null
          dose_g_integration_low: number | null
          dose_g_per_kg: number | null
          dose_sequence: number
          duration_hr: number | null
          experience_notes: string | null
          heart_rate_at_onset: number | null
          id: string
          medical_intervention: boolean | null
          medical_notes: string | null
          member_id: string
          member_weight_kg: number | null
          member_weight_lbs: number | null
          notes: string | null
          peak_onset_min: number | null
          protocol_type: string
          qtc_peak: number | null
          qtc_pre_dose: number | null
          updated_at: string
          visionary_intensity: number | null
        }
        Insert: {
          administered_at: string
          administered_by?: string | null
          adverse_events?: string | null
          batch_id?: string | null
          bp_diastolic_at_onset?: number | null
          bp_systolic_at_onset?: number | null
          ceremony_id?: string | null
          created_at?: string
          dose_g: number
          dose_g_consult_high?: number | null
          dose_g_consult_low?: number | null
          dose_g_deep_high?: number | null
          dose_g_deep_low?: number | null
          dose_g_flood_high?: number | null
          dose_g_flood_low?: number | null
          dose_g_flood_mid?: number | null
          dose_g_integration_high?: number | null
          dose_g_integration_low?: number | null
          dose_g_per_kg?: number | null
          dose_sequence?: number
          duration_hr?: number | null
          experience_notes?: string | null
          heart_rate_at_onset?: number | null
          id?: string
          medical_intervention?: boolean | null
          medical_notes?: string | null
          member_id: string
          member_weight_kg?: number | null
          member_weight_lbs?: number | null
          notes?: string | null
          peak_onset_min?: number | null
          protocol_type?: string
          qtc_peak?: number | null
          qtc_pre_dose?: number | null
          updated_at?: string
          visionary_intensity?: number | null
        }
        Update: {
          administered_at?: string
          administered_by?: string | null
          adverse_events?: string | null
          batch_id?: string | null
          bp_diastolic_at_onset?: number | null
          bp_systolic_at_onset?: number | null
          ceremony_id?: string | null
          created_at?: string
          dose_g?: number
          dose_g_consult_high?: number | null
          dose_g_consult_low?: number | null
          dose_g_deep_high?: number | null
          dose_g_deep_low?: number | null
          dose_g_flood_high?: number | null
          dose_g_flood_low?: number | null
          dose_g_flood_mid?: number | null
          dose_g_integration_high?: number | null
          dose_g_integration_low?: number | null
          dose_g_per_kg?: number | null
          dose_sequence?: number
          duration_hr?: number | null
          experience_notes?: string | null
          heart_rate_at_onset?: number | null
          id?: string
          medical_intervention?: boolean | null
          medical_notes?: string | null
          member_id?: string
          member_weight_kg?: number | null
          member_weight_lbs?: number | null
          notes?: string | null
          peak_onset_min?: number | null
          protocol_type?: string
          qtc_peak?: number | null
          qtc_pre_dose?: number | null
          updated_at?: string
          visionary_intensity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dosing_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosing_records_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "dosing_records_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosing_records_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "dosing_records_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "dosing_records_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "dosing_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          amount_cents: number
          category: string
          cohort_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          incurred_at: string
          journey_id: string | null
          notes: string | null
          receipt_url: string | null
          scope: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          category: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          incurred_at: string
          journey_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          scope: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          incurred_at?: string
          journey_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          scope?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "expense_entries_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "expense_entries_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "expense_entries_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
        ]
      }
      followup_tasks: {
        Row: {
          ceremony_id: string | null
          completed_at: string | null
          created_at: string
          due_date: string
          email_subject: string | null
          id: string
          last_reminder_at: string | null
          member_id: string
          notes: string | null
          outcome_id: string | null
          reminder_count: number
          sent_at: string | null
          status: string
          survey_token: string | null
          survey_token_expires_at: string | null
          timepoint: string
          updated_at: string
        }
        Insert: {
          ceremony_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          email_subject?: string | null
          id?: string
          last_reminder_at?: string | null
          member_id: string
          notes?: string | null
          outcome_id?: string | null
          reminder_count?: number
          sent_at?: string | null
          status?: string
          survey_token?: string | null
          survey_token_expires_at?: string | null
          timepoint: string
          updated_at?: string
        }
        Update: {
          ceremony_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          email_subject?: string | null
          id?: string
          last_reminder_at?: string | null
          member_id?: string
          notes?: string | null
          outcome_id?: string | null
          reminder_count?: number
          sent_at?: string | null
          status?: string
          survey_token?: string | null
          survey_token_expires_at?: string | null
          timepoint?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_tasks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "followup_tasks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_tasks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "followup_tasks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "followup_tasks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "followup_tasks_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_tasks_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "followup_tasks_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "followup_tasks_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          accommodation_requests: string | null
          additional_notes: string | null
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          body_relationship: string | null
          boundaries_needs: string | null
          cardiac_cleared: boolean | null
          childhood_history: string | null
          created_at: string | null
          current_medications: string | null
          current_supplements: string | null
          current_therapy: string | null
          date_of_birth: string | null
          dietary_restrictions: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          emotional_patterns: string | null
          grounding_practices: string | null
          health_history: string | null
          heart_conditions: string | null
          home_support_people: string | null
          home_support_selection: string | null
          iboga_contraindications: Json | null
          id: string
          integration_history: string | null
          legal_name: string | null
          location: string | null
          medical_notes: string | null
          medication_interactions: string | null
          member_id: string
          mental_health_status: string | null
          personal_growth: string | null
          phone: string | null
          physician_name: string | null
          physician_phone: string | null
          preferred_name: string | null
          previous_psychedelic_exp: string | null
          previous_psychedelic_experience: string | null
          primary_intention: string | null
          psychiatric_history: string | null
          responses: Json | null
          resting_heart_rate: number | null
          signature: string | null
          signed_at: string | null
          signed_date: string | null
          signer_name: string | null
          submission_date: string | null
          substance_history: string | null
          supplements: string | null
          what_brings_you_here: string | null
        }
        Insert: {
          accommodation_requests?: string | null
          additional_notes?: string | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_relationship?: string | null
          boundaries_needs?: string | null
          cardiac_cleared?: boolean | null
          childhood_history?: string | null
          created_at?: string | null
          current_medications?: string | null
          current_supplements?: string | null
          current_therapy?: string | null
          date_of_birth?: string | null
          dietary_restrictions?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          emotional_patterns?: string | null
          grounding_practices?: string | null
          health_history?: string | null
          heart_conditions?: string | null
          home_support_people?: string | null
          home_support_selection?: string | null
          iboga_contraindications?: Json | null
          id?: string
          integration_history?: string | null
          legal_name?: string | null
          location?: string | null
          medical_notes?: string | null
          medication_interactions?: string | null
          member_id: string
          mental_health_status?: string | null
          personal_growth?: string | null
          phone?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          preferred_name?: string | null
          previous_psychedelic_exp?: string | null
          previous_psychedelic_experience?: string | null
          primary_intention?: string | null
          psychiatric_history?: string | null
          responses?: Json | null
          resting_heart_rate?: number | null
          signature?: string | null
          signed_at?: string | null
          signed_date?: string | null
          signer_name?: string | null
          submission_date?: string | null
          substance_history?: string | null
          supplements?: string | null
          what_brings_you_here?: string | null
        }
        Update: {
          accommodation_requests?: string | null
          additional_notes?: string | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_relationship?: string | null
          boundaries_needs?: string | null
          cardiac_cleared?: boolean | null
          childhood_history?: string | null
          created_at?: string | null
          current_medications?: string | null
          current_supplements?: string | null
          current_therapy?: string | null
          date_of_birth?: string | null
          dietary_restrictions?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          emotional_patterns?: string | null
          grounding_practices?: string | null
          health_history?: string | null
          heart_conditions?: string | null
          home_support_people?: string | null
          home_support_selection?: string | null
          iboga_contraindications?: Json | null
          id?: string
          integration_history?: string | null
          legal_name?: string | null
          location?: string | null
          medical_notes?: string | null
          medication_interactions?: string | null
          member_id?: string
          mental_health_status?: string | null
          personal_growth?: string | null
          phone?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          preferred_name?: string | null
          previous_psychedelic_exp?: string | null
          previous_psychedelic_experience?: string | null
          primary_intention?: string | null
          psychiatric_history?: string | null
          responses?: Json | null
          resting_heart_rate?: number | null
          signature?: string | null
          signed_at?: string | null
          signed_date?: string | null
          signer_name?: string | null
          submission_date?: string | null
          substance_history?: string | null
          supplements?: string | null
          what_brings_you_here?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      integration_specialists: {
        Row: {
          active: boolean
          bio: string | null
          calendly_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          photo_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          calendly_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          photo_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          calendly_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      journey_email_log: {
        Row: {
          arc: string
          id: string
          journey_id: string
          member_id: string
          recipient_email: string
          resend_id: string | null
          sent_at: string
          subject: string
          template_snapshot: Json | null
          week_idx: number
        }
        Insert: {
          arc: string
          id?: string
          journey_id: string
          member_id: string
          recipient_email: string
          resend_id?: string | null
          sent_at?: string
          subject: string
          template_snapshot?: Json | null
          week_idx: number
        }
        Update: {
          arc?: string
          id?: string
          journey_id?: string
          member_id?: string
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string
          subject?: string
          template_snapshot?: Json | null
          week_idx?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_email_log_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_email_log_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_email_log_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_email_log_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journey_email_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      journey_email_templates: {
        Row: {
          action_items: Json
          arc: string
          id: string
          intro: string
          principle: string
          principle_name: string
          subject: string
          theme: string
          updated_at: string
          updated_by: string | null
          week_idx: number
        }
        Insert: {
          action_items?: Json
          arc: string
          id?: string
          intro: string
          principle: string
          principle_name: string
          subject: string
          theme: string
          updated_at?: string
          updated_by?: string | null
          week_idx: number
        }
        Update: {
          action_items?: Json
          arc?: string
          id?: string
          intro?: string
          principle?: string
          principle_name?: string
          subject?: string
          theme?: string
          updated_at?: string
          updated_by?: string | null
          week_idx?: number
        }
        Relationships: []
      }
      journeys: {
        Row: {
          approved_at: string | null
          booking_type: string
          canceled_at: string | null
          cohort_id: string | null
          created_at: string
          end_at: string | null
          id: string
          location_id: string | null
          member_id: string
          notes: string | null
          schedule_type: string
          scheduled_at: string | null
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          booking_type: string
          canceled_at?: string | null
          cohort_id?: string | null
          created_at?: string
          end_at?: string | null
          id?: string
          location_id?: string | null
          member_id: string
          notes?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          booking_type?: string
          canceled_at?: string | null
          cohort_id?: string | null
          created_at?: string
          end_at?: string | null
          id?: string
          location_id?: string | null
          member_id?: string
          notes?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_documents: {
        Row: {
          ai_extracted_data: Json | null
          ai_processed_at: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          founder_notes: string | null
          founder_reviewed_at: string | null
          id: string
          lab_type: string
          member_id: string
          reviewed_by: string | null
          status: string
          uploaded_at: string
        }
        Insert: {
          ai_extracted_data?: Json | null
          ai_processed_at?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          founder_notes?: string | null
          founder_reviewed_at?: string | null
          id?: string
          lab_type: string
          member_id: string
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string
        }
        Update: {
          ai_extracted_data?: Json | null
          ai_processed_at?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          founder_notes?: string | null
          founder_reviewed_at?: string | null
          id?: string
          lab_type?: string
          member_id?: string
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          approval_decided_at: string | null
          approval_decided_by: string | null
          approval_status: string
          approval_token: string | null
          calendly_booked_at: string | null
          calendly_event_id: string | null
          converted_to_member: boolean | null
          created_at: string | null
          decline_reason: string | null
          discovery_call_booked: boolean | null
          discovery_call_date: string | null
          email: string
          full_name: string
          id: string
          invite_sent_at: string | null
          lead_date: string | null
          member_id: string | null
          message: string | null
          notes: string | null
          phone: string | null
          source: string | null
          welcome_video_sent: boolean | null
        }
        Insert: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_status?: string
          approval_token?: string | null
          calendly_booked_at?: string | null
          calendly_event_id?: string | null
          converted_to_member?: boolean | null
          created_at?: string | null
          decline_reason?: string | null
          discovery_call_booked?: boolean | null
          discovery_call_date?: string | null
          email: string
          full_name: string
          id?: string
          invite_sent_at?: string | null
          lead_date?: string | null
          member_id?: string | null
          message?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          welcome_video_sent?: boolean | null
        }
        Update: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_status?: string
          approval_token?: string | null
          calendly_booked_at?: string | null
          calendly_event_id?: string | null
          converted_to_member?: boolean | null
          created_at?: string | null
          decline_reason?: string | null
          discovery_call_booked?: boolean | null
          discovery_call_date?: string | null
          email?: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          lead_date?: string | null
          member_id?: string | null
          message?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          welcome_video_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      medical_note_entries: {
        Row: {
          author_name: string
          author_role: string
          author_user_id: string | null
          created_at: string
          id: string
          member_id: string
          note: string
        }
        Insert: {
          author_name: string
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          member_id: string
          note: string
        }
        Update: {
          author_name?: string
          author_role?: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "medical_note_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      medicine_batches: {
        Row: {
          batch_code: string
          coa_date: string | null
          coa_file_path: string | null
          coa_lab: string | null
          created_at: string
          expiry_date: string | null
          heavy_metals_pass: boolean | null
          ibogaine_pct: number | null
          ibogamine_pct: number | null
          id: string
          lot_number: string | null
          medicine_form: string
          microbial_pass: boolean | null
          noribogaine_pct: number | null
          notes: string | null
          pesticides_pass: boolean | null
          quantity_g: number | null
          quantity_remaining_g: number | null
          received_date: string | null
          supplier: string | null
          tabernanthine_pct: number | null
          total_alkaloids_pct: number | null
          updated_at: string
          voacangine_pct: number | null
        }
        Insert: {
          batch_code: string
          coa_date?: string | null
          coa_file_path?: string | null
          coa_lab?: string | null
          created_at?: string
          expiry_date?: string | null
          heavy_metals_pass?: boolean | null
          ibogaine_pct?: number | null
          ibogamine_pct?: number | null
          id?: string
          lot_number?: string | null
          medicine_form?: string
          microbial_pass?: boolean | null
          noribogaine_pct?: number | null
          notes?: string | null
          pesticides_pass?: boolean | null
          quantity_g?: number | null
          quantity_remaining_g?: number | null
          received_date?: string | null
          supplier?: string | null
          tabernanthine_pct?: number | null
          total_alkaloids_pct?: number | null
          updated_at?: string
          voacangine_pct?: number | null
        }
        Update: {
          batch_code?: string
          coa_date?: string | null
          coa_file_path?: string | null
          coa_lab?: string | null
          created_at?: string
          expiry_date?: string | null
          heavy_metals_pass?: boolean | null
          ibogaine_pct?: number | null
          ibogamine_pct?: number | null
          id?: string
          lot_number?: string | null
          medicine_form?: string
          microbial_pass?: boolean | null
          noribogaine_pct?: number | null
          notes?: string | null
          pesticides_pass?: boolean | null
          quantity_g?: number | null
          quantity_remaining_g?: number | null
          received_date?: string | null
          supplier?: string | null
          tabernanthine_pct?: number | null
          total_alkaloids_pct?: number | null
          updated_at?: string
          voacangine_pct?: number | null
        }
        Relationships: []
      }
      member_checklist: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          item_key: string
          member_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item_key: string
          member_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item_key?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_checklist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_drafts: {
        Row: {
          form_key: string
          id: string
          member_id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          form_key: string
          id?: string
          member_id: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          form_key?: string
          id?: string
          member_id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      member_journals: {
        Row: {
          created_at: string
          id: string
          last_saved_at: string
          member_id: string
          responses: Json
        }
        Insert: {
          created_at?: string
          id?: string
          last_saved_at?: string
          member_id: string
          responses?: Json
        }
        Update: {
          created_at?: string
          id?: string
          last_saved_at?: string
          member_id?: string
          responses?: Json
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          created_at: string
          deposit_amount: number | null
          deposit_paid: boolean
          deposit_paid_at: string | null
          email: string
          full_name: string | null
          id: string
          intake_form_completed: boolean
          intake_form_completed_at: string | null
          invited_at: string | null
          medical_disclaimer_signature: string | null
          medical_disclaimer_signed: boolean
          medical_disclaimer_signed_at: string | null
          membership_agreement_signature: string | null
          membership_agreement_signed: boolean
          membership_agreement_signed_at: string | null
          membership_donation_amount_cents: number | null
          membership_donation_completed: boolean
          membership_donation_completed_at: string | null
          onboarding_complete: boolean
          onboarding_completed_at: string | null
          phone: string | null
          safety_agreement_initials: Json | null
          safety_agreement_preferences: Json | null
          safety_agreement_signature: string | null
          safety_agreement_signed: boolean
          safety_agreement_signed_at: string | null
          track_addiction: boolean | null
          track_autism_regulation: boolean | null
          track_chronic_illness: boolean | null
          track_cognitive: boolean | null
          track_motor: boolean | null
          track_pain: boolean | null
          track_ptsd: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          email: string
          full_name?: string | null
          id: string
          intake_form_completed?: boolean
          intake_form_completed_at?: string | null
          invited_at?: string | null
          medical_disclaimer_signature?: string | null
          medical_disclaimer_signed?: boolean
          medical_disclaimer_signed_at?: string | null
          membership_agreement_signature?: string | null
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          membership_donation_amount_cents?: number | null
          membership_donation_completed?: boolean
          membership_donation_completed_at?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          safety_agreement_initials?: Json | null
          safety_agreement_preferences?: Json | null
          safety_agreement_signature?: string | null
          safety_agreement_signed?: boolean
          safety_agreement_signed_at?: string | null
          track_addiction?: boolean | null
          track_autism_regulation?: boolean | null
          track_chronic_illness?: boolean | null
          track_cognitive?: boolean | null
          track_motor?: boolean | null
          track_pain?: boolean | null
          track_ptsd?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          intake_form_completed?: boolean
          intake_form_completed_at?: string | null
          invited_at?: string | null
          medical_disclaimer_signature?: string | null
          medical_disclaimer_signed?: boolean
          medical_disclaimer_signed_at?: string | null
          membership_agreement_signature?: string | null
          membership_agreement_signed?: boolean
          membership_agreement_signed_at?: string | null
          membership_donation_amount_cents?: number | null
          membership_donation_completed?: boolean
          membership_donation_completed_at?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          safety_agreement_initials?: Json | null
          safety_agreement_preferences?: Json | null
          safety_agreement_signature?: string | null
          safety_agreement_signed?: boolean
          safety_agreement_signed_at?: string | null
          track_addiction?: boolean | null
          track_autism_regulation?: boolean | null
          track_chronic_illness?: boolean | null
          track_cognitive?: boolean | null
          track_motor?: boolean | null
          track_pain?: boolean | null
          track_ptsd?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      member_risk_scores: {
        Row: {
          calculated_at: string
          cardiac_cleared: boolean | null
          contraindication_flag_count: number | null
          days_to_ceremony: number | null
          id: string
          labs_all_cleared: boolean | null
          medically_cleared: boolean | null
          member_id: string
          overdue_followup_count: number | null
          risk_factors: Json
          risk_level: string
          risk_score: number
        }
        Insert: {
          calculated_at?: string
          cardiac_cleared?: boolean | null
          contraindication_flag_count?: number | null
          days_to_ceremony?: number | null
          id?: string
          labs_all_cleared?: boolean | null
          medically_cleared?: boolean | null
          member_id: string
          overdue_followup_count?: number | null
          risk_factors?: Json
          risk_level: string
          risk_score?: number
        }
        Update: {
          calculated_at?: string
          cardiac_cleared?: boolean | null
          contraindication_flag_count?: number | null
          days_to_ceremony?: number | null
          id?: string
          labs_all_cleared?: boolean | null
          medically_cleared?: boolean | null
          member_id?: string
          overdue_followup_count?: number | null
          risk_factors?: Json
          risk_level?: string
          risk_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_session_allowances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          journey_id: string | null
          member_id: string
          note: string | null
          quantity: number
          reason: string
          session_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          journey_id?: string | null
          member_id: string
          note?: string | null
          quantity: number
          reason?: string
          session_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          journey_id?: string | null
          member_id?: string
          note?: string | null
          quantity?: number
          reason?: string
          session_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_session_allowances_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "member_session_allowances_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "member_session_allowances_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_session_allowances_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "member_session_allowances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_session_allowances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_session_allowances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_timelines: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          event_date: string
          event_detail: string | null
          event_title: string
          event_type: string
          id: string
          is_system: boolean
          member_id: string
          metadata: Json | null
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          event_date?: string
          event_detail?: string | null
          event_title: string
          event_type: string
          id?: string
          is_system?: boolean
          member_id: string
          metadata?: Json | null
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          event_date?: string
          event_detail?: string | null
          event_title?: string
          event_type?: string
          id?: string
          is_system?: boolean
          member_id?: string
          metadata?: Json | null
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      members: {
        Row: {
          agreement_version: string | null
          arrival_date: string | null
          assigned_nurse_id: string | null
          assigned_partner: string | null
          bp_diastolic: number | null
          bp_systolic: number | null
          cardiac_cleared: boolean | null
          ceremony_date: string | null
          cost_of_service: number | null
          created_at: string | null
          departure_date: string | null
          email: string
          full_name: string
          heart_rate: number | null
          id: string
          integration_guide: string | null
          integration_guide_calendly: string | null
          integration_unlocked: boolean | null
          journal_sharing_decided_at: string | null
          journal_sharing_enabled: boolean
          journey_focus: string | null
          lead_id: string | null
          legacy_journal_access_enabled: boolean
          medical_cleared: boolean | null
          medical_notes: string | null
          medication_interactions: string | null
          membership_tier: string | null
          notes: string | null
          phone: string | null
          portal_unlocked: boolean | null
          profile_id: string | null
          program_price: number | null
          signature: string | null
          signed_at: string | null
          status: string | null
        }
        Insert: {
          agreement_version?: string | null
          arrival_date?: string | null
          assigned_nurse_id?: string | null
          assigned_partner?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          cost_of_service?: number | null
          created_at?: string | null
          departure_date?: string | null
          email: string
          full_name: string
          heart_rate?: number | null
          id?: string
          integration_guide?: string | null
          integration_guide_calendly?: string | null
          integration_unlocked?: boolean | null
          journal_sharing_decided_at?: string | null
          journal_sharing_enabled?: boolean
          journey_focus?: string | null
          lead_id?: string | null
          legacy_journal_access_enabled?: boolean
          medical_cleared?: boolean | null
          medical_notes?: string | null
          medication_interactions?: string | null
          membership_tier?: string | null
          notes?: string | null
          phone?: string | null
          portal_unlocked?: boolean | null
          profile_id?: string | null
          program_price?: number | null
          signature?: string | null
          signed_at?: string | null
          status?: string | null
        }
        Update: {
          agreement_version?: string | null
          arrival_date?: string | null
          assigned_nurse_id?: string | null
          assigned_partner?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          cost_of_service?: number | null
          created_at?: string | null
          departure_date?: string | null
          email?: string
          full_name?: string
          heart_rate?: number | null
          id?: string
          integration_guide?: string | null
          integration_guide_calendly?: string | null
          integration_unlocked?: boolean | null
          journal_sharing_decided_at?: string | null
          journal_sharing_enabled?: boolean
          journey_focus?: string | null
          lead_id?: string | null
          legacy_journal_access_enabled?: boolean
          medical_cleared?: boolean | null
          medical_notes?: string | null
          medication_interactions?: string | null
          membership_tier?: string | null
          notes?: string | null
          phone?: string | null
          portal_unlocked?: boolean | null
          profile_id?: string | null
          program_price?: number | null
          signature?: string | null
          signed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_assigned_nurse_id_fkey"
            columns: ["assigned_nurse_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          lead_id: string | null
          notification_type: string
          payload: Json | null
          recipient: string[]
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          lead_id?: string | null
          notification_type: string
          payload?: Json | null
          recipient: string[]
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          lead_id?: string | null
          notification_type?: string
          payload?: Json | null
          recipient?: string[]
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          member_id: string | null
          message: string | null
          severity: string
          source_id: string | null
          source_table: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          message?: string | null
          severity: string
          source_id?: string | null
          source_table?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          message?: string | null
          severity?: string
          source_id?: string | null
          source_table?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      ops_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          member_id: string
          owner_name: string | null
          owner_user_id: string | null
          priority: string
          source_reason: string | null
          source_view: string | null
          status: string
          task_type: string
          text_sent_at: string | null
          text_sent_count: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          member_id: string
          owner_name?: string | null
          owner_user_id?: string | null
          priority?: string
          source_reason?: string | null
          source_view?: string | null
          status?: string
          task_type: string
          text_sent_at?: string | null
          text_sent_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          member_id?: string
          owner_name?: string | null
          owner_user_id?: string | null
          priority?: string
          source_reason?: string | null
          source_view?: string | null
          status?: string
          task_type?: string
          text_sent_at?: string | null
          text_sent_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      outcome_assessments: {
        Row: {
          adverse_alert_sent_at: string | null
          adverse_effects_staff_notes: string | null
          adverse_event_flag: boolean | null
          adverse_event_member_report: string | null
          assessment_date: string
          audit_total: number | null
          brain_fog_score: number | null
          ceremony_id: string | null
          cgis_score: number | null
          completed_by: string | null
          confusion_frequency_score: number | null
          craving_intensity: number | null
          created_at: string
          daily_independence_score: number | null
          dast10_total: number | null
          days_abstinent: number | null
          days_from_ceremony: number | null
          days_used_past_30: number | null
          eligibility_snapshot: Json | null
          emotional_intensity_score: number | null
          fatigue_score: number | null
          functional_capacity_score: number | null
          functioning_score: number | null
          gad7_q1: number | null
          gad7_q2: number | null
          gad7_q3: number | null
          gad7_q4: number | null
          gad7_q5: number | null
          gad7_q6: number | null
          gad7_q7: number | null
          gad7_severity: string | null
          gad7_total: number | null
          id: string
          inflammation_score: number | null
          is_final: boolean
          is_locked: boolean
          journey_id: string | null
          last_saved_at: string | null
          medications_current: string | null
          member_id: string
          memory_clarity_score: number | null
          motor_function_score: number | null
          motor_interference_score: number | null
          notes: string | null
          operational_member_id: string | null
          overall_change: string | null
          overdue_submission: boolean
          pain_intensity_score: number | null
          pain_interference_score: number | null
          pattern_intensity: number | null
          pattern_return_level: string | null
          pattern_returned: boolean | null
          pcl5_severity: string | null
          pcl5_total: number | null
          pgis_score: number | null
          phq9_q1: number | null
          phq9_q2: number | null
          phq9_q3: number | null
          phq9_q4: number | null
          phq9_q5: number | null
          phq9_q6: number | null
          phq9_q7: number | null
          phq9_q8: number | null
          phq9_q9: number | null
          phq9_severity: string | null
          phq9_total: number | null
          practice_days: number | null
          primary_intention: string | null
          primary_substance: string | null
          qol_active: number | null
          qol_calm: number | null
          qol_cheerful: number | null
          qol_fresh: number | null
          qol_interesting: number | null
          qol_total: number | null
          regulation_score: number | null
          relapse_date: string | null
          relapse_occurred: boolean | null
          relapse_substance: string | null
          replaces_assessment_id: string | null
          response_to_returned_patterns_score: number | null
          rigidity_score: number | null
          sensory_overwhelm_score: number | null
          shutdown_dysregulation_score: number | null
          sleep_hours_avg: number | null
          sleep_latency_min: number | null
          sleep_quality: number | null
          social_ease_score: number | null
          started_at: string | null
          subjective_experience: string | null
          submitted_at: string | null
          support_alert_sent_at: string | null
          support_needed_now: boolean | null
          support_score: number | null
          timepoint: string
          top_symptom_1: string | null
          top_symptom_2: string | null
          top_symptom_3: string | null
          tremor_score: number | null
          updated_at: string
          used_target_substance: boolean | null
          used_target_substance_frequency: string | null
          version_number: number
          what_has_lasted: string | null
          window_due_at: string | null
          window_hard_close_at: string | null
          window_open_at: string | null
          year_reflection: string | null
        }
        Insert: {
          adverse_alert_sent_at?: string | null
          adverse_effects_staff_notes?: string | null
          adverse_event_flag?: boolean | null
          adverse_event_member_report?: string | null
          assessment_date?: string
          audit_total?: number | null
          brain_fog_score?: number | null
          ceremony_id?: string | null
          cgis_score?: number | null
          completed_by?: string | null
          confusion_frequency_score?: number | null
          craving_intensity?: number | null
          created_at?: string
          daily_independence_score?: number | null
          dast10_total?: number | null
          days_abstinent?: number | null
          days_from_ceremony?: number | null
          days_used_past_30?: number | null
          eligibility_snapshot?: Json | null
          emotional_intensity_score?: number | null
          fatigue_score?: number | null
          functional_capacity_score?: number | null
          functioning_score?: number | null
          gad7_q1?: number | null
          gad7_q2?: number | null
          gad7_q3?: number | null
          gad7_q4?: number | null
          gad7_q5?: number | null
          gad7_q6?: number | null
          gad7_q7?: number | null
          gad7_severity?: string | null
          gad7_total?: number | null
          id?: string
          inflammation_score?: number | null
          is_final?: boolean
          is_locked?: boolean
          journey_id?: string | null
          last_saved_at?: string | null
          medications_current?: string | null
          member_id: string
          memory_clarity_score?: number | null
          motor_function_score?: number | null
          motor_interference_score?: number | null
          notes?: string | null
          operational_member_id?: string | null
          overall_change?: string | null
          overdue_submission?: boolean
          pain_intensity_score?: number | null
          pain_interference_score?: number | null
          pattern_intensity?: number | null
          pattern_return_level?: string | null
          pattern_returned?: boolean | null
          pcl5_severity?: string | null
          pcl5_total?: number | null
          pgis_score?: number | null
          phq9_q1?: number | null
          phq9_q2?: number | null
          phq9_q3?: number | null
          phq9_q4?: number | null
          phq9_q5?: number | null
          phq9_q6?: number | null
          phq9_q7?: number | null
          phq9_q8?: number | null
          phq9_q9?: number | null
          phq9_severity?: string | null
          phq9_total?: number | null
          practice_days?: number | null
          primary_intention?: string | null
          primary_substance?: string | null
          qol_active?: number | null
          qol_calm?: number | null
          qol_cheerful?: number | null
          qol_fresh?: number | null
          qol_interesting?: number | null
          qol_total?: number | null
          regulation_score?: number | null
          relapse_date?: string | null
          relapse_occurred?: boolean | null
          relapse_substance?: string | null
          replaces_assessment_id?: string | null
          response_to_returned_patterns_score?: number | null
          rigidity_score?: number | null
          sensory_overwhelm_score?: number | null
          shutdown_dysregulation_score?: number | null
          sleep_hours_avg?: number | null
          sleep_latency_min?: number | null
          sleep_quality?: number | null
          social_ease_score?: number | null
          started_at?: string | null
          subjective_experience?: string | null
          submitted_at?: string | null
          support_alert_sent_at?: string | null
          support_needed_now?: boolean | null
          support_score?: number | null
          timepoint: string
          top_symptom_1?: string | null
          top_symptom_2?: string | null
          top_symptom_3?: string | null
          tremor_score?: number | null
          updated_at?: string
          used_target_substance?: boolean | null
          used_target_substance_frequency?: string | null
          version_number?: number
          what_has_lasted?: string | null
          window_due_at?: string | null
          window_hard_close_at?: string | null
          window_open_at?: string | null
          year_reflection?: string | null
        }
        Update: {
          adverse_alert_sent_at?: string | null
          adverse_effects_staff_notes?: string | null
          adverse_event_flag?: boolean | null
          adverse_event_member_report?: string | null
          assessment_date?: string
          audit_total?: number | null
          brain_fog_score?: number | null
          ceremony_id?: string | null
          cgis_score?: number | null
          completed_by?: string | null
          confusion_frequency_score?: number | null
          craving_intensity?: number | null
          created_at?: string
          daily_independence_score?: number | null
          dast10_total?: number | null
          days_abstinent?: number | null
          days_from_ceremony?: number | null
          days_used_past_30?: number | null
          eligibility_snapshot?: Json | null
          emotional_intensity_score?: number | null
          fatigue_score?: number | null
          functional_capacity_score?: number | null
          functioning_score?: number | null
          gad7_q1?: number | null
          gad7_q2?: number | null
          gad7_q3?: number | null
          gad7_q4?: number | null
          gad7_q5?: number | null
          gad7_q6?: number | null
          gad7_q7?: number | null
          gad7_severity?: string | null
          gad7_total?: number | null
          id?: string
          inflammation_score?: number | null
          is_final?: boolean
          is_locked?: boolean
          journey_id?: string | null
          last_saved_at?: string | null
          medications_current?: string | null
          member_id?: string
          memory_clarity_score?: number | null
          motor_function_score?: number | null
          motor_interference_score?: number | null
          notes?: string | null
          operational_member_id?: string | null
          overall_change?: string | null
          overdue_submission?: boolean
          pain_intensity_score?: number | null
          pain_interference_score?: number | null
          pattern_intensity?: number | null
          pattern_return_level?: string | null
          pattern_returned?: boolean | null
          pcl5_severity?: string | null
          pcl5_total?: number | null
          pgis_score?: number | null
          phq9_q1?: number | null
          phq9_q2?: number | null
          phq9_q3?: number | null
          phq9_q4?: number | null
          phq9_q5?: number | null
          phq9_q6?: number | null
          phq9_q7?: number | null
          phq9_q8?: number | null
          phq9_q9?: number | null
          phq9_severity?: string | null
          phq9_total?: number | null
          practice_days?: number | null
          primary_intention?: string | null
          primary_substance?: string | null
          qol_active?: number | null
          qol_calm?: number | null
          qol_cheerful?: number | null
          qol_fresh?: number | null
          qol_interesting?: number | null
          qol_total?: number | null
          regulation_score?: number | null
          relapse_date?: string | null
          relapse_occurred?: boolean | null
          relapse_substance?: string | null
          replaces_assessment_id?: string | null
          response_to_returned_patterns_score?: number | null
          rigidity_score?: number | null
          sensory_overwhelm_score?: number | null
          shutdown_dysregulation_score?: number | null
          sleep_hours_avg?: number | null
          sleep_latency_min?: number | null
          sleep_quality?: number | null
          social_ease_score?: number | null
          started_at?: string | null
          subjective_experience?: string | null
          submitted_at?: string | null
          support_alert_sent_at?: string | null
          support_needed_now?: boolean | null
          support_score?: number | null
          timepoint?: string
          top_symptom_1?: string | null
          top_symptom_2?: string | null
          top_symptom_3?: string | null
          tremor_score?: number | null
          updated_at?: string
          used_target_substance?: boolean | null
          used_target_substance_frequency?: string | null
          version_number?: number
          what_has_lasted?: string | null
          window_due_at?: string | null
          window_hard_close_at?: string | null
          window_open_at?: string | null
          year_reflection?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "outcome_assessments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "outcome_assessments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["operational_member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_commitments: {
        Row: {
          amount_cents: number
          cohort_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          journey_id: string | null
          notes: string | null
          paid_at: string | null
          payee_email: string | null
          payee_name: string
          role: string
          scope: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          journey_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payee_email?: string | null
          payee_name: string
          role: string
          scope: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          journey_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payee_email?: string | null
          payee_name?: string
          role?: string
          scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_commitments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "payout_commitments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_commitments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "payout_commitments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "payout_commitments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_commitments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
        ]
      }
      post_ceremony_progress: {
        Row: {
          checklist_items: Json | null
          created_at: string | null
          current_week: number | null
          id: string
          journal_responses: Json | null
          last_updated: string | null
          member_id: string | null
          monthly_checkins: Json | null
          monthly_tracking: Json | null
          weekly_tracking: Json | null
          weeks_completed: number[] | null
        }
        Insert: {
          checklist_items?: Json | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          journal_responses?: Json | null
          last_updated?: string | null
          member_id?: string | null
          monthly_checkins?: Json | null
          monthly_tracking?: Json | null
          weekly_tracking?: Json | null
          weeks_completed?: number[] | null
        }
        Update: {
          checklist_items?: Json | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          journal_responses?: Json | null
          last_updated?: string | null
          member_id?: string | null
          monthly_checkins?: Json | null
          monthly_tracking?: Json | null
          weekly_tracking?: Json | null
          weeks_completed?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "post_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          notes: string | null
          practitioner_id: string
          signed_at: string | null
          title: string | null
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          notes?: string | null
          practitioner_id: string
          signed_at?: string | null
          title?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          notes?: string | null
          practitioner_id?: string
          signed_at?: string | null
          title?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_documents_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioners: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          engagement_type: string
          full_name: string
          id: string
          integration_specialist_id: string | null
          notes: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          engagement_type?: string
          full_name: string
          id?: string
          integration_specialist_id?: string | null
          notes?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          engagement_type?: string
          full_name?: string
          id?: string
          integration_specialist_id?: string | null
          notes?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioners_integration_specialist_id_fkey"
            columns: ["integration_specialist_id"]
            isOneToOne: false
            referencedRelation: "integration_specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_ceremony_progress: {
        Row: {
          checklist_items: Json | null
          created_at: string | null
          current_week: number | null
          id: string
          journal_responses: Json | null
          last_updated: string | null
          member_id: string | null
          weeks_completed: number[] | null
        }
        Insert: {
          checklist_items?: Json | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          journal_responses?: Json | null
          last_updated?: string | null
          member_id?: string | null
          weeks_completed?: number[] | null
        }
        Update: {
          checklist_items?: Json | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          journal_responses?: Json | null
          last_updated?: string | null
          member_id?: string | null
          weeks_completed?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pre_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pre_ceremony_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_template_days: {
        Row: {
          created_at: string
          day_number: number
          description: string | null
          id: string
          template_id: string
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          description?: string | null
          id?: string
          template_id: string
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          description?: string | null
          id?: string
          template_id?: string
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_template_items: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          day_offset: number
          end_time: string
          id: string
          is_private: boolean
          location: string | null
          notes: string | null
          sort_order: number
          start_time: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          day_offset?: number
          end_time: string
          id?: string
          is_private?: boolean
          location?: string | null
          notes?: string | null
          sort_order?: number
          start_time: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          day_offset?: number
          end_time?: string
          id?: string
          is_private?: boolean
          location?: string | null
          notes?: string | null
          sort_order?: number
          start_time?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_templates: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduling_requests: {
        Row: {
          created_at: string
          earliest_date: string
          excluded_ranges: Json
          id: string
          journey_id: string | null
          latest_date: string
          member_id: string
          notes: string | null
          preferred_cohort_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          earliest_date: string
          excluded_ranges?: Json
          id?: string
          journey_id?: string | null
          latest_date: string
          member_id: string
          notes?: string | null
          preferred_cohort_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          earliest_date?: string
          excluded_ranges?: Json
          id?: string
          journey_id?: string | null
          latest_date?: string
          member_id?: string
          notes?: string | null
          preferred_cohort_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_requests_preferred_cohort_id_fkey"
            columns: ["preferred_cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "scheduling_requests_preferred_cohort_id_fkey"
            columns: ["preferred_cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_bookings: {
        Row: {
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          canceled_at: string | null
          counts_against_allowance: boolean
          created_at: string
          id: string
          invitee_email: string | null
          invitee_name: string | null
          journey_id: string | null
          member_id: string | null
          needs_review: boolean
          scheduled_at: string | null
          session_type: string
          status: string
          updated_at: string
        }
        Insert: {
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          canceled_at?: string | null
          counts_against_allowance?: boolean
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          journey_id?: string | null
          member_id?: string | null
          needs_review?: boolean
          scheduled_at?: string | null
          session_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          canceled_at?: string | null
          counts_against_allowance?: boolean
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          journey_id?: string | null
          member_id?: string | null
          needs_review?: boolean
          scheduled_at?: string | null
          session_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_bookings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "session_bookings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "session_bookings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "session_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "session_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "session_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          superseded_at: string | null
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          full_name?: string | null
          superseded_at?: string | null
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          superseded_at?: string | null
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signed_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_version: string | null
          id: string
          ip_address: string | null
          member_id: string
          signature: string | null
          signed_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_version?: string | null
          id?: string
          ip_address?: string | null
          member_id: string
          signature?: string | null
          signed_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_version?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string
          signature?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "signed_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          channel: string
          direction: string
          email_subject: string | null
          error_message: string | null
          id: string
          member_id: string | null
          message: string
          sent_at: string
          sent_by: string | null
          sms_type: string
          status: string
          task_id: string | null
          to_name: string | null
          to_phone: string | null
          twilio_sid: string | null
        }
        Insert: {
          channel?: string
          direction?: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          message: string
          sent_at?: string
          sent_by?: string | null
          sms_type: string
          status?: string
          task_id?: string | null
          to_name?: string | null
          to_phone?: string | null
          twilio_sid?: string | null
        }
        Update: {
          channel?: string
          direction?: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          message?: string
          sent_at?: string
          sent_by?: string | null
          sms_type?: string
          status?: string
          task_id?: string | null
          to_name?: string | null
          to_phone?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sms_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ops_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ops_today_view"
            referencedColumns: ["task_id"]
          },
        ]
      }
      transactional_email_templates: {
        Row: {
          audience: string
          body_html: string | null
          closing_html: string | null
          cta_label: string | null
          description: string | null
          display_name: string
          editable: boolean
          eyebrow: string | null
          heading: string | null
          key: string
          lead_html: string | null
          subject: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          audience: string
          body_html?: string | null
          closing_html?: string | null
          cta_label?: string | null
          description?: string | null
          display_name: string
          editable?: boolean
          eyebrow?: string | null
          heading?: string | null
          key: string
          lead_html?: string | null
          subject: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          audience?: string
          body_html?: string | null
          closing_html?: string | null
          cta_label?: string | null
          description?: string | null
          display_name?: string
          editable?: boolean
          eyebrow?: string | null
          heading?: string | null
          key?: string
          lead_html?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_receipts: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          idempotency_key: string | null
          lead_id: string | null
          processing_error: string | null
          processing_status: string
          raw_body: Json | null
          raw_headers: Json | null
          received_at: string
          source: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          processing_error?: string | null
          processing_status?: string
          raw_body?: Json | null
          raw_headers?: Json | null
          received_at?: string
          source?: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          processing_error?: string | null
          processing_status?: string
          raw_body?: Json | null
          raw_headers?: Json | null
          received_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_receipts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      adverse_events_review_view: {
        Row: {
          action_taken: string | null
          assessment_id: string | null
          ceremony_date: string | null
          ceremony_id: string | null
          classified_at: string | null
          classified_by: string | null
          days_since_reported: number | null
          description: string | null
          escalated_at: string | null
          escalated_to: string | null
          escalation_required: boolean | null
          event_type: string | null
          full_name: string | null
          id: string | null
          member_id: string | null
          onset_date: string | null
          ops_task_open: boolean | null
          relatedness: string | null
          reported_at: string | null
          reported_by: string | null
          reporter_contact_at: string | null
          reporter_contact_made: boolean | null
          resolution_date: string | null
          resolution_status: string | null
          review_status: string | null
          severity: string | null
          staff_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "adverse_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "adverse_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      assessment_completion_summary: {
        Row: {
          ceremony_date: string | null
          ceremony_id: string | null
          completed_n: number | null
          completion_rate_pct: number | null
          gad7_mean: number | null
          gad7_n: number | null
          missed_n: number | null
          not_yet_open_n: number | null
          pending_n: number | null
          phq9_mean: number | null
          phq9_n: number | null
          phq9_sd: number | null
          qol_mean: number | null
          sort_order: number | null
          timepoint: string | null
          timepoint_label: string | null
          total_members: number | null
        }
        Relationships: []
      }
      assessment_draft_status: {
        Row: {
          assessment_date: string | null
          auth_user_id: string | null
          completed_by: string | null
          created_at: string | null
          functioning_complete: boolean | null
          gad7_complete: boolean | null
          id: string | null
          is_final: boolean | null
          member_id: string | null
          overall_change_complete: boolean | null
          phq9_complete: boolean | null
          qol_complete: boolean | null
          ready_to_finalize: boolean | null
          record_status: string | null
          replaces_assessment_id: string | null
          timepoint: string | null
          updated_at: string | null
          version_number: number | null
        }
        Insert: {
          assessment_date?: string | null
          auth_user_id?: string | null
          completed_by?: string | null
          created_at?: string | null
          functioning_complete?: never
          gad7_complete?: never
          id?: string | null
          is_final?: boolean | null
          member_id?: string | null
          overall_change_complete?: never
          phq9_complete?: never
          qol_complete?: never
          ready_to_finalize?: never
          record_status?: never
          replaces_assessment_id?: string | null
          timepoint?: string | null
          updated_at?: string | null
          version_number?: number | null
        }
        Update: {
          assessment_date?: string | null
          auth_user_id?: string | null
          completed_by?: string | null
          created_at?: string | null
          functioning_complete?: never
          gad7_complete?: never
          id?: string | null
          is_final?: boolean | null
          member_id?: string | null
          overall_change_complete?: never
          phq9_complete?: never
          qol_complete?: never
          ready_to_finalize?: never
          record_status?: never
          replaces_assessment_id?: string | null
          timepoint?: string | null
          updated_at?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_draft_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_scale_completeness"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "outcome_assessments_replaces_assessment_id_fkey"
            columns: ["replaces_assessment_id"]
            isOneToOne: false
            referencedRelation: "outcome_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scale_completeness: {
        Row: {
          assessment_date: string | null
          assessment_id: string | null
          audit_items_stored: number | null
          dast10_items_stored: number | null
          member_id: string | null
          pcl5_items_stored: number | null
          timepoint: string | null
        }
        Insert: {
          assessment_date?: string | null
          assessment_id?: string | null
          audit_items_stored?: never
          dast10_items_stored?: never
          member_id?: string | null
          pcl5_items_stored?: never
          timepoint?: string | null
        }
        Update: {
          assessment_date?: string | null
          assessment_id?: string | null
          audit_items_stored?: never
          dast10_items_stored?: never
          member_id?: string | null
          pcl5_items_stored?: never
          timepoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      ceremony_schedule_view: {
        Row: {
          arrival_date: string | null
          assigned_partner: string | null
          cardiac_cleared: boolean | null
          ceremony_date: string | null
          days_until_ceremony: number | null
          email: string | null
          full_name: string | null
          integration_guide: string | null
          journey_focus: string | null
          medical_cleared: boolean | null
          member_id: string | null
        }
        Insert: {
          arrival_date?: string | null
          assigned_partner?: string | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          days_until_ceremony?: never
          email?: string | null
          full_name?: string | null
          integration_guide?: string | null
          journey_focus?: string | null
          medical_cleared?: boolean | null
          member_id?: string | null
        }
        Update: {
          arrival_date?: string | null
          assigned_partner?: string | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          days_until_ceremony?: never
          email?: string | null
          full_name?: string | null
          integration_guide?: string | null
          journey_focus?: string | null
          medical_cleared?: boolean | null
          member_id?: string | null
        }
        Relationships: []
      }
      cohort_financial_summary: {
        Row: {
          cohort_id: string | null
          cohort_title: string | null
          collected_revenue_cents: number | null
          enrolled_members: number | null
          expected_revenue_cents: number | null
          paid_members: number | null
          remaining_revenue_cents: number | null
          start_at: string | null
          unpaid_members: number | null
        }
        Relationships: []
      }
      cohort_summary: {
        Row: {
          abstinent_days_mean: number | null
          adverse_event_count: number | null
          ceremony_id: string | null
          craving_mean: number | null
          functioning_mean: number | null
          gad7_mean: number | null
          gad7_sd: number | null
          n: number | null
          pattern_intensity_mean: number | null
          pgis_mean: number | null
          phq9_mean: number | null
          phq9_sd: number | null
          qol_mean: number | null
          regulation_mean: number | null
          relapse_count: number | null
          relapse_rate_pct: number | null
          sleep_hours_mean: number | null
          sleep_quality_mean: number | null
          timepoint: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
        ]
      }
      contraindication_flags_view: {
        Row: {
          contraindication_key: string | null
          flag_value: string | null
          member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "intake_forms_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      donation_financials: {
        Row: {
          failed_count: number | null
          pending_cents: number | null
          pending_count: number | null
          refunded_cents: number | null
          refunded_count: number | null
          total_completed_cents: number | null
          total_completed_count: number | null
        }
        Relationships: []
      }
      dose_outcome_linkage: {
        Row: {
          assessment_date: string | null
          batch_code: string | null
          ceremony_id: string | null
          cgis_score: number | null
          coa_lab: string | null
          craving_intensity: number | null
          days_abstinent: number | null
          days_from_ceremony: number | null
          dose_g: number | null
          dose_g_per_kg: number | null
          dose_high_flag: boolean | null
          dose_range_label: string | null
          duration_hr: number | null
          gad7_severity: string | null
          gad7_total: number | null
          ibogaine_g_actual: number | null
          ibogaine_pct: number | null
          medicine_form: string | null
          member_id: string | null
          member_weight_kg: number | null
          member_weight_lbs: number | null
          pgis_score: number | null
          phq9_severity: string | null
          phq9_total: number | null
          primary_substance: string | null
          protocol_type: string | null
          qol_total: number | null
          qtc_critical: boolean | null
          qtc_elevated: boolean | null
          qtc_peak: number | null
          qtc_pre_dose: number | null
          relapse_occurred: boolean | null
          sleep_hours_avg: number | null
          sleep_quality: number | null
          timepoint: string | null
          total_alkaloids_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      financial_summary_view: {
        Row: {
          cost_of_service: number | null
          email: string | null
          full_name: string | null
          margin_percent: number | null
          member_id: string | null
          membership_tier: string | null
          profit: number | null
          program_price: number | null
          status: string | null
        }
        Insert: {
          cost_of_service?: number | null
          email?: string | null
          full_name?: string | null
          margin_percent?: never
          member_id?: string | null
          membership_tier?: string | null
          profit?: never
          program_price?: number | null
          status?: string | null
        }
        Update: {
          cost_of_service?: number | null
          email?: string | null
          full_name?: string | null
          margin_percent?: never
          member_id?: string | null
          membership_tier?: string | null
          profit?: never
          program_price?: number | null
          status?: string | null
        }
        Relationships: []
      }
      followup_overdue_view: {
        Row: {
          ceremony_date: string | null
          ceremony_id: string | null
          days_overdue: number | null
          due_date: string | null
          full_name: string | null
          member_id: string | null
          task_exists: boolean | null
          timepoint: string | null
          urgency: string | null
        }
        Relationships: []
      }
      journey_financial_summary: {
        Row: {
          booking_type: string | null
          cohort_id: string | null
          collected_amount_cents: number | null
          commitment_id: string | null
          expected_amount_cents: number | null
          journey_id: string | null
          member_id: string | null
          payment_status: string | null
          remaining_amount_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_summary_view: {
        Row: {
          booking_type: string | null
          cohort_id: string | null
          cohort_title: string | null
          created_at: string | null
          days_until_start: number | null
          end_at: string | null
          finalized_assessment_count: number | null
          has_finalized_assessments: boolean | null
          journey_id: string | null
          member_email: string | null
          member_id: string | null
          member_name: string | null
          next_timepoint: string | null
          portal_display_date: string | null
          portal_display_status: string | null
          reschedule_action: string | null
          schedule_type: string | null
          start_at: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "journeys_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journeys_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      latest_lab_documents_view: {
        Row: {
          ai_extracted_data: Json | null
          ai_processed_at: string | null
          created_at: string | null
          file_name: string | null
          file_path: string | null
          file_size_bytes: number | null
          founder_notes: string | null
          founder_reviewed_at: string | null
          id: string | null
          lab_type: string | null
          member_id: string | null
          reviewed_by: string | null
          rn: number | null
          status: string | null
          uploaded_at: string | null
        }
        Relationships: []
      }
      member_assessment_status: {
        Row: {
          assessment_id: string | null
          ceremony_date: string | null
          ceremony_id: string | null
          ceremony_status: string | null
          days_remaining: number | null
          email: string | null
          full_name: string | null
          gad7_severity: string | null
          gad7_total: number | null
          is_editable: boolean | null
          is_final: boolean | null
          is_locked: boolean | null
          is_overdue_window: boolean | null
          last_saved_at: string | null
          member_id: string | null
          overall_change: string | null
          overdue_submission: boolean | null
          pcl5_severity: string | null
          pcl5_total: number | null
          phq9_severity: string | null
          phq9_total: number | null
          qol_total: number | null
          regulation_score: number | null
          sort_order: number | null
          started_at: string | null
          status: string | null
          submission_count: number | null
          submitted_at: string | null
          timepoint: string | null
          timepoint_label: string | null
          version_number: number | null
          window_close_at: string | null
          window_due_at: string | null
          window_hard_close_at: string | null
          window_open_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ceremony_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_document_status: {
        Row: {
          all_required_signed: boolean | null
          arrival_date: string | null
          ceremony_date: string | null
          disclaimer_signed: boolean | null
          email: string | null
          full_name: string | null
          intake_signed: boolean | null
          integration_guide: string | null
          integration_guide_calendly: string | null
          integration_unlocked: boolean | null
          member_id: string | null
          membership_signed: boolean | null
          portal_unlocked: boolean | null
        }
        Relationships: []
      }
      member_donation_summary: {
        Row: {
          donation_amount_cents: number | null
          donation_completed: boolean | null
          donation_completed_at: string | null
          email: string | null
          full_name: string | null
          latest_donation_amount_cents: number | null
          latest_donation_currency: string | null
          latest_donation_paid_at: string | null
          latest_donation_status: string | null
          member_id: string | null
          receipt_url: string | null
          stripe_payment_intent_id: string | null
        }
        Relationships: []
      }
      member_financial_overview: {
        Row: {
          active_commitment_id: string | null
          active_journey_id: string | null
          booking_type: string | null
          email: string | null
          financial_status: string | null
          full_name: string | null
          journey_expected_amount_cents: number | null
          journey_paid_amount_cents: number | null
          journey_remaining_amount_cents: number | null
          journey_status: string | null
          member_id: string | null
          onboarding_donation_amount_cents: number | null
          onboarding_donation_completed: boolean | null
        }
        Relationships: []
      }
      member_lab_status: {
        Row: {
          all_cleared: boolean | null
          cmp_approved: boolean | null
          cyp450_approved: boolean | null
          ekg_approved: boolean | null
          liver_approved: boolean | null
          magnesium_approved: boolean | null
          member_id: string | null
          stress_test_approved: boolean | null
          thyroid_approved: boolean | null
          total_approved: number | null
          total_submitted: number | null
        }
        Relationships: []
      }
      member_medical_snapshot_view: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          bp_diastolic: number | null
          bp_systolic: number | null
          cardiac_cleared: boolean | null
          ceremony_date: string | null
          cmp_approved: boolean | null
          current_medications: string | null
          current_supplements: string | null
          cyp450_approved: boolean | null
          ekg_approved: boolean | null
          email: string | null
          full_name: string | null
          heart_conditions: string | null
          heart_rate: number | null
          iboga_contraindications: Json | null
          intake_cardiac_cleared: boolean | null
          journey_focus: string | null
          labs_all_cleared: boolean | null
          liver_approved: boolean | null
          magnesium_approved: boolean | null
          medical_cleared: boolean | null
          medical_notes: string | null
          medication_interactions: string | null
          member_id: string | null
          psychiatric_history: string | null
          resting_heart_rate: number | null
          stress_test_approved: boolean | null
          substance_history: string | null
          thyroid_approved: boolean | null
          total_approved: number | null
          total_submitted: number | null
        }
        Relationships: []
      }
      member_onboarding_status_view: {
        Row: {
          deposit_paid: boolean | null
          email: string | null
          full_name: string | null
          medical_disclaimer_signed: boolean | null
          member_id: string | null
          membership_agreement_signed: boolean | null
          next_required_step: string | null
          onboarding_complete: boolean | null
          onboarding_steps_complete: number | null
        }
        Relationships: []
      }
      member_outcomes_summary_view: {
        Row: {
          assessment_count: number | null
          assigned_partner: string | null
          baseline_gad7: number | null
          baseline_phq9: number | null
          baseline_qol: number | null
          baseline_regulation: number | null
          baseline_sleep: number | null
          ceremony_date: string | null
          ceremony_id: string | null
          full_name: string | null
          gad7_delta: number | null
          latest_date: string | null
          latest_gad7: number | null
          latest_phq9: number | null
          latest_qol: number | null
          latest_regulation: number | null
          latest_sleep: number | null
          latest_timepoint: string | null
          member_id: string | null
          pattern_intensity: number | null
          pattern_return_level: string | null
          pattern_returned: boolean | null
          phq9_delta: number | null
          phq9_pct_improvement: number | null
          phq9_response_class: string | null
          practice_days: number | null
          qol_delta: number | null
          regulation_delta: number | null
          sleep_delta: number | null
        }
        Relationships: []
      }
      member_pipeline_view: {
        Row: {
          all_required_signed: boolean | null
          arrival_date: string | null
          assigned_partner: string | null
          cardiac_cleared: boolean | null
          ceremony_count: number | null
          ceremony_date: string | null
          contact_phone: string | null
          contraindication_flag_count: number | null
          contraindication_keys: string[] | null
          cost_of_service: number | null
          created_at: string | null
          cyp450_approved: boolean | null
          days_to_ceremony: number | null
          deposit_paid: boolean | null
          disclaimer_signed: boolean | null
          ekg_approved: boolean | null
          email: string | null
          full_name: string | null
          intake_signed: boolean | null
          intake_submitted_at: string | null
          integration_guide: string | null
          integration_guide_calendly: string | null
          integration_unlocked: boolean | null
          journey_focus: string | null
          labs_all_cleared: boolean | null
          latest_ceremony_status: string | null
          liver_approved: boolean | null
          medical_cleared: boolean | null
          medical_disclaimer_signed: boolean | null
          medication_interactions: string | null
          member_id: string | null
          membership_agreement_signed: boolean | null
          membership_signed: boolean | null
          membership_tier: string | null
          onboarding_complete: boolean | null
          overdue_followup_count: number | null
          phone: string | null
          pipeline_stage: string | null
          portal_unlocked: boolean | null
          primary_intention: string | null
          profile_id: string | null
          program_price: number | null
          risk_level: string | null
          risk_reasons: string[] | null
          status: string | null
          total_approved: number | null
          total_submitted: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_risk_view: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          bp_diastolic: number | null
          bp_systolic: number | null
          cardiac_cleared: boolean | null
          ceremony_date: string | null
          contraindication_flag_count: number | null
          contraindication_keys: string[] | null
          current_medications: string | null
          cyp450_approved: boolean | null
          ekg_approved: boolean | null
          email: string | null
          full_name: string | null
          heart_conditions: string | null
          heart_rate: number | null
          iboga_contraindications: Json | null
          intake_cardiac_cleared: boolean | null
          journey_focus: string | null
          labs_all_cleared: boolean | null
          liver_approved: boolean | null
          medical_cleared: boolean | null
          member_id: string | null
          resting_heart_rate: number | null
          risk_level: string | null
          risk_reasons: string[] | null
          total_approved: number | null
          total_submitted: number | null
        }
        Relationships: []
      }
      member_timeline_view: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          event_date: string | null
          event_detail: string | null
          event_title: string | null
          event_type: string | null
          full_name: string | null
          is_system: boolean | null
          member_id: string | null
          metadata: Json | null
          source_id: string | null
          source_table: string | null
          timeline_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_timelines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      nurse_member_medical: {
        Row: {
          arrival_date: string | null
          bp_diastolic: number | null
          bp_systolic: number | null
          cardiac_cleared: boolean | null
          ceremony_date: string | null
          departure_date: string | null
          email: string | null
          full_name: string | null
          heart_rate: number | null
          id: string | null
          journey_focus: string | null
          medical_cleared: boolean | null
          medical_notes: string | null
          medication_interactions: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          arrival_date?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          departure_date?: string | null
          email?: string | null
          full_name?: string | null
          heart_rate?: number | null
          id?: string | null
          journey_focus?: string | null
          medical_cleared?: boolean | null
          medical_notes?: string | null
          medication_interactions?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          arrival_date?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cardiac_cleared?: boolean | null
          ceremony_date?: string | null
          departure_date?: string | null
          email?: string | null
          full_name?: string | null
          heart_rate?: number | null
          id?: string | null
          journey_focus?: string | null
          medical_cleared?: boolean | null
          medical_notes?: string | null
          medication_interactions?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ops_today_view: {
        Row: {
          days_to_ceremony: number | null
          due_date: string | null
          full_name: string | null
          member_id: string | null
          owner_name: string | null
          priority: string | null
          risk_level: string | null
          risk_score: number | null
          sort_priority: number | null
          source_reason: string | null
          status: string | null
          task_created_at: string | null
          task_id: string | null
          task_type: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "ops_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      participant_trajectory: {
        Row: {
          assessment_date: string | null
          ceremony_id: string | null
          craving_intensity: number | null
          days_abstinent: number | null
          days_from_ceremony: number | null
          functioning_score: number | null
          gad7_baseline: number | null
          gad7_change: number | null
          gad7_pct_improvement: number | null
          gad7_total: number | null
          member_id: string | null
          overall_change: string | null
          pattern_return_level: string | null
          phq9_baseline: number | null
          phq9_change: number | null
          phq9_pct_improvement: number | null
          phq9_total: number | null
          qol_baseline: number | null
          qol_change: number | null
          qol_total: number | null
          regulation_baseline: number | null
          regulation_change: number | null
          regulation_score: number | null
          relapse_occurred: boolean | null
          timepoint: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ceremony_schedule_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "financial_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_document_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_medical_snapshot_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding_status_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_pipeline_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_risk_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "nurse_member_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "post_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "outcome_assessments_operational_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pre_ceremony_progress_view"
            referencedColumns: ["member_id"]
          },
        ]
      }
      post_ceremony_progress_view: {
        Row: {
          email: string | null
          full_name: string | null
          last_updated: string | null
          member_id: string | null
          post_program_complete: boolean | null
          weekly_tracking: Json | null
          weeks_completed: number[] | null
          weeks_completed_count: number | null
        }
        Relationships: []
      }
      pre_ceremony_progress_view: {
        Row: {
          current_week: number | null
          email: string | null
          full_name: string | null
          last_updated: string | null
          member_id: string | null
          prep_complete: boolean | null
          weeks_completed: number[] | null
          weeks_completed_count: number | null
        }
        Relationships: []
      }
      recent_financial_activity: {
        Row: {
          amount_cents: number | null
          cohort_id: string | null
          created_at: string | null
          donation_kind: string | null
          journey_id: string | null
          member_name: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_financial_summary"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "donations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "donations_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "donations_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
        ]
      }
      research_export_deidentified: {
        Row: {
          adverse_event_flag: boolean | null
          audit_total: number | null
          cohort_key: string | null
          craving_intensity: number | null
          dast10_total: number | null
          days_abstinent: number | null
          days_from_ceremony: number | null
          days_used_past_30: number | null
          dose_g_per_kg: number | null
          emotional_intensity_score: number | null
          functioning_score: number | null
          gad7_severity: string | null
          gad7_total: number | null
          ibogaine_pct: number | null
          overall_change: string | null
          overdue_submission: boolean | null
          pattern_intensity: number | null
          pattern_return_level: string | null
          pattern_returned: boolean | null
          pcl5_severity: string | null
          pcl5_total: number | null
          phq9_severity: string | null
          phq9_total: number | null
          practice_days: number | null
          protocol_type: string | null
          qol_total: number | null
          qtc_peak: number | null
          regulation_score: number | null
          relapse_occurred: boolean | null
          response_to_returned_patterns_score: number | null
          sleep_hours_avg: number | null
          sleep_quality: number | null
          subject_key: string | null
          submitted_date: string | null
          support_needed_now: boolean | null
          support_score: number | null
          timepoint: string | null
          timepoint_order: number | null
          total_alkaloids_pct: number | null
          version_number: number | null
        }
        Relationships: []
      }
      research_export_founders: {
        Row: {
          adverse_event_flag: boolean | null
          batch_code: string | null
          ceremony_id: string | null
          craving_intensity: number | null
          days_abstinent: number | null
          days_from_ceremony: number | null
          dose_g_per_kg: number | null
          emotional_intensity_score: number | null
          functioning_score: number | null
          gad7_severity: string | null
          gad7_total: number | null
          ibogaine_pct: number | null
          member_name: string | null
          overall_change: string | null
          overdue_submission: boolean | null
          pattern_intensity: number | null
          pattern_return_level: string | null
          pattern_returned: boolean | null
          pcl5_severity: string | null
          pcl5_total: number | null
          phq9_severity: string | null
          phq9_total: number | null
          practice_days: number | null
          primary_intention: string | null
          protocol_type: string | null
          qol_total: number | null
          qtc_peak: number | null
          regulation_score: number | null
          relapse_occurred: boolean | null
          sleep_hours_avg: number | null
          sleep_quality: number | null
          subject_key: string | null
          subjective_experience: string | null
          submitted_at: string | null
          support_needed_now: boolean | null
          support_score: number | null
          timepoint: string | null
          version_number: number | null
          what_has_lasted: string | null
          year_reflection: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "assessment_completion_summary"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremony_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "followup_overdue_view"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_assessment_status"
            referencedColumns: ["ceremony_id"]
          },
          {
            foreignKeyName: "outcome_assessments_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "member_outcomes_summary_view"
            referencedColumns: ["ceremony_id"]
          },
        ]
      }
      scheduling_requests_view: {
        Row: {
          availability_label: string | null
          created_at: string | null
          days_waiting: number | null
          earliest_date: string | null
          excluded_ranges: Json | null
          journey_id: string | null
          journey_status: string | null
          latest_date: string | null
          member_email: string | null
          member_id: string | null
          member_name: string | null
          notes: string | null
          portal_display_date: string | null
          request_id: string | null
          request_status: string | null
          reviewed_at: string | null
          submitted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_financial_summary"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey_summary_view"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["active_journey_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_donation_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_financial_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "scheduling_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _refresh_ops_alerts_internal: { Args: never; Returns: number }
      assessment_window: {
        Args: { p_ceremony_date: string; p_timepoint: string }
        Returns: {
          close_at: string
          due_at: string
          hard_close_at: string
          open_at: string
        }[]
      }
      backfill_journeys_from_ceremony_records: {
        Args: never
        Returns: {
          action: string
          ceremony_date: string
          journey_id: string
          member_email: string
          note: string
          op_member_id: string
        }[]
      }
      create_or_resume_assessment: {
        Args: {
          p_auth_user_id: string
          p_ceremony_id: string
          p_timepoint: string
        }
        Returns: Json
      }
      current_practitioner_id: { Args: never; Returns: string }
      finalize_assessment: { Args: { p_assessment_id: string }; Returns: Json }
      fn_set_audit_context: {
        Args: { p_actor_id: string; p_actor_type: string; p_reason: string }
        Returns: undefined
      }
      get_auth_id_from_member: {
        Args: { p_member_id: string }
        Returns: string
      }
      get_member_id_from_auth: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      get_operational_member_id: {
        Args: { p_profile_id: string }
        Returns: string
      }
      get_public_cohorts: {
        Args: never
        Returns: {
          assigned_count: number
          capacity: number
          end_at: string
          id: string
          start_at: string
          title: string
        }[]
      }
      is_assigned_guide: { Args: { member_uuid: string }; Returns: boolean }
      is_assigned_nurse: { Args: { member_uuid: string }; Returns: boolean }
      is_founder: { Args: never; Returns: boolean }
      is_nurse: { Args: never; Returns: boolean }
      recompute_commitment_status_for: {
        Args: { p_commitment_id: string }
        Returns: undefined
      }
      refresh_ops_alerts: { Args: never; Returns: number }
      supersede_assessment: {
        Args: { p_new_assessment_id: string; p_old_assessment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_status:
        | "inquiry"
        | "invited"
        | "booked"
        | "confirmed"
        | "completed"
        | "cancelled"
      payment_status:
        | "unpaid"
        | "payment_link_sent"
        | "deposit_paid"
        | "paid"
        | "payment_plan_active"
        | "failed"
        | "refunded"
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
      booking_status: [
        "inquiry",
        "invited",
        "booked",
        "confirmed",
        "completed",
        "cancelled",
      ],
      payment_status: [
        "unpaid",
        "payment_link_sent",
        "deposit_paid",
        "paid",
        "payment_plan_active",
        "failed",
        "refunded",
      ],
    },
  },
} as const
