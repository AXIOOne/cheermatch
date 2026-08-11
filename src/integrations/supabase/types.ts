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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      content_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_videos: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_types: {
        Row: {
          category: Database["public"]["Enums"]["deduction_category"]
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          points: number
          template_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["deduction_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          points: number
          template_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["deduction_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          points?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_types_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string
          description: string | null
          discipline: string
          id: string
          level: string | null
          max_age: number | null
          min_age: number | null
          name: string
          scoring_template_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discipline?: string
          id?: string
          level?: string | null
          max_age?: number | null
          min_age?: number | null
          name: string
          scoring_template_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discipline?: string
          id?: string
          level?: string | null
          max_age?: number | null
          min_age?: number | null
          name?: string
          scoring_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisions_scoring_template_id_fkey"
            columns: ["scoring_template_id"]
            isOneToOne: false
            referencedRelation: "scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          subject: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          accuscore_end_at: string | null
          broadcast_channel: string
          broadcast_deadline_date: string | null
          broadcast_deadline_time: string
          created_at: string
          created_by: string
          current_match: string | null
          description: string | null
          discipline: string | null
          dont_show_scoresheet: boolean
          duration_of_capture: number
          end_date: string
          end_time: string
          event_uuid: string | null
          hide_from_leaderboard: boolean
          hide_from_website: boolean
          hide_video_from_team_gym_division: boolean
          id: string
          list_on_special_events_page: boolean
          long_description: string | null
          name: string
          per_show_registrations: number
          reg_cost: number
          registration_close_at: string | null
          registration_open_at: string | null
          release_score_leaderboard: boolean
          sanctioned_event: boolean
          scoresheet_template_name: string | null
          scoring_close_at: string | null
          scoring_open_at: string | null
          screen_capture_cnt: number
          season_id: number
          show_teams_and_divisions: boolean
          start_date: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          sub_deadline: string | null
          submission_close_at: string | null
          submission_open_at: string | null
          time_zone: string
          updated_at: string
        }
        Insert: {
          accuscore_end_at?: string | null
          broadcast_channel?: string
          broadcast_deadline_date?: string | null
          broadcast_deadline_time?: string
          created_at?: string
          created_by: string
          current_match?: string | null
          description?: string | null
          discipline?: string | null
          dont_show_scoresheet?: boolean
          duration_of_capture?: number
          end_date: string
          end_time?: string
          event_uuid?: string | null
          hide_from_leaderboard?: boolean
          hide_from_website?: boolean
          hide_video_from_team_gym_division?: boolean
          id?: string
          list_on_special_events_page?: boolean
          long_description?: string | null
          name: string
          per_show_registrations?: number
          reg_cost?: number
          registration_close_at?: string | null
          registration_open_at?: string | null
          release_score_leaderboard?: boolean
          sanctioned_event?: boolean
          scoresheet_template_name?: string | null
          scoring_close_at?: string | null
          scoring_open_at?: string | null
          screen_capture_cnt?: number
          season_id?: number
          show_teams_and_divisions?: boolean
          start_date: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          sub_deadline?: string | null
          submission_close_at?: string | null
          submission_open_at?: string | null
          time_zone?: string
          updated_at?: string
        }
        Update: {
          accuscore_end_at?: string | null
          broadcast_channel?: string
          broadcast_deadline_date?: string | null
          broadcast_deadline_time?: string
          created_at?: string
          created_by?: string
          current_match?: string | null
          description?: string | null
          discipline?: string | null
          dont_show_scoresheet?: boolean
          duration_of_capture?: number
          end_date?: string
          end_time?: string
          event_uuid?: string | null
          hide_from_leaderboard?: boolean
          hide_from_website?: boolean
          hide_video_from_team_gym_division?: boolean
          id?: string
          list_on_special_events_page?: boolean
          long_description?: string | null
          name?: string
          per_show_registrations?: number
          reg_cost?: number
          registration_close_at?: string | null
          registration_open_at?: string | null
          release_score_leaderboard?: boolean
          sanctioned_event?: boolean
          scoresheet_template_name?: string | null
          scoring_close_at?: string | null
          scoring_open_at?: string | null
          screen_capture_cnt?: number
          season_id?: number
          show_teams_and_divisions?: boolean
          start_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          sub_deadline?: string | null
          submission_close_at?: string | null
          submission_open_at?: string | null
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      judge_assignments: {
        Row: {
          created_at: string
          division_id: string | null
          event_id: string
          id: string
          judge_user_id: string
          level_id: string | null
          panel_id: string | null
          section_id: string | null
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          event_id: string
          id?: string
          judge_user_id: string
          level_id?: string | null
          panel_id?: string | null
          section_id?: string | null
        }
        Update: {
          created_at?: string
          division_id?: string | null
          event_id?: string
          id?: string
          judge_user_id?: string
          level_id?: string | null
          panel_id?: string | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judge_assignments_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "judge_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "scoring_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_panels: {
        Row: {
          abbreviation: string
          created_at: string
          description: string | null
          display_order: number
          event_id: string
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          description?: string | null
          display_order?: number
          event_id: string
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          description?: string | null
          display_order?: number
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_panels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level_number: number
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level_number: number
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level_number?: number
          name?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      mobile_sessions: {
        Row: {
          created_at: string
          expires_at: string
          last_seen_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          last_seen_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          last_seen_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          city: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          organization_name: string | null
          password_hash: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          organization_name?: string | null
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          organization_name?: string | null
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      score_deductions: {
        Row: {
          count: number
          created_at: string
          deduction_type_id: string
          id: string
          notes: string | null
          score_id: string
          warnings: number
        }
        Insert: {
          count?: number
          created_at?: string
          deduction_type_id: string
          id?: string
          notes?: string | null
          score_id: string
          warnings?: number
        }
        Update: {
          count?: number
          created_at?: string
          deduction_type_id?: string
          id?: string
          notes?: string | null
          score_id?: string
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_deductions_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "deduction_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_deductions_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      score_details: {
        Row: {
          created_at: string
          field_id: string
          id: string
          notes: string | null
          points: number
          score_id: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          notes?: string | null
          points: number
          score_id: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          notes?: string | null
          points?: number
          score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_details_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "scoring_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_details_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      score_field_overrides: {
        Row: {
          created_at: string
          field_id: string
          id: string
          new_points: number
          original_points: number | null
          overridden_by: string
          reason: string
          score_id: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          new_points?: number
          original_points?: number | null
          overridden_by: string
          reason: string
          score_id: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          new_points?: number
          original_points?: number | null
          overridden_by?: string
          reason?: string
          score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_field_overrides_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "scoring_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_field_overrides_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      score_skill_selections: {
        Row: {
          created_at: string
          id: string
          option_id: string
          score_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          score_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          score_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_skill_selections_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "scoring_field_skill_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_skill_selections_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_skill_selections_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "scoring_field_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          comments: string | null
          created_at: string
          deductions: number | null
          id: string
          judge_user_id: string
          needs_review: boolean
          panel_id: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["score_status"]
          submission_id: string
          submitted_at: string | null
          template_id: string
          total_score: number | null
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          deductions?: number | null
          id?: string
          judge_user_id: string
          needs_review?: boolean
          panel_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          submission_id: string
          submitted_at?: string | null
          template_id: string
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          deductions?: number | null
          id?: string
          judge_user_id?: string
          needs_review?: boolean
          panel_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          submission_id?: string
          submitted_at?: string | null
          template_id?: string
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "judge_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_field_options: {
        Row: {
          created_at: string
          display_order: number
          field_id: string
          id: string
          label: string
          value: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_id: string
          id?: string
          label: string
          value?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          field_id?: string
          id?: string
          label?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "scoring_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_field_panels: {
        Row: {
          created_at: string
          field_id: string
          id: string
          panel_abbreviation: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          panel_abbreviation: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          panel_abbreviation?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_field_panels_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "scoring_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_field_skill_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          label: string
          skill_id: string
          value: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          label: string
          skill_id: string
          value?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          skill_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_field_skill_options_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "scoring_field_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_field_skills: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          field_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          field_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          field_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_field_skills_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "scoring_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_fields: {
        Row: {
          aggregation: Database["public"]["Enums"]["scoring_field_aggregation"]
          created_at: string
          description: string | null
          display_order: number
          field_type: Database["public"]["Enums"]["scoring_field_type"]
          id: string
          max_points: number
          max_value: number
          min_value: number
          name: string
          score_type: string
          section_id: string
          start_value: number | null
          step: number
          template_id: string
          updated_at: string
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["scoring_field_aggregation"]
          created_at?: string
          description?: string | null
          display_order?: number
          field_type?: Database["public"]["Enums"]["scoring_field_type"]
          id?: string
          max_points?: number
          max_value?: number
          min_value?: number
          name: string
          score_type?: string
          section_id: string
          start_value?: number | null
          step?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["scoring_field_aggregation"]
          created_at?: string
          description?: string | null
          display_order?: number
          field_type?: Database["public"]["Enums"]["scoring_field_type"]
          id?: string
          max_points?: number
          max_value?: number
          min_value?: number
          name?: string
          score_type?: string
          section_id?: string
          start_value?: number | null
          step?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "scoring_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_review_tokens: {
        Row: {
          coach_email: string
          coach_name: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          requested_at: string | null
          review_notes: string | null
          status: string
          submission_id: string
          token: string
        }
        Insert: {
          coach_email: string
          coach_name?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          requested_at?: string | null
          review_notes?: string | null
          status?: string
          submission_id: string
          token?: string
        }
        Update: {
          coach_email?: string
          coach_name?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          requested_at?: string | null
          review_notes?: string | null
          status?: string
          submission_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_review_tokens_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rubrics: {
        Row: {
          created_at: string
          description: string | null
          discipline: string | null
          division_id: string | null
          event_id: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          level_id: string | null
          mime_type: string | null
          season: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discipline?: string | null
          division_id?: string | null
          event_id?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          level_id?: string | null
          mime_type?: string | null
          season?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discipline?: string | null
          division_id?: string | null
          event_id?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          level_id?: string | null
          mime_type?: string | null
          season?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rubrics_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_rubrics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_rubrics_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_sections: {
        Row: {
          abbreviation: string
          created_at: string
          default_panel_abbreviation: string | null
          description: string | null
          display_order: number
          id: string
          max_points: number
          name: string
          template_id: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          default_panel_abbreviation?: string | null
          description?: string | null
          display_order?: number
          id?: string
          max_points?: number
          name: string
          template_id: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          default_panel_abbreviation?: string | null
          description?: string | null
          display_order?: number
          id?: string
          max_points?: number
          name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_templates: {
        Row: {
          created_at: string
          description: string | null
          discipline: string | null
          event_id: string | null
          id: string
          is_default: boolean
          is_locked: boolean
          name: string
          show_comments_on_scoresheet: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discipline?: string | null
          event_id?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          name: string
          show_comments_on_scoresheet?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discipline?: string | null
          event_id?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          name?: string
          show_comments_on_scoresheet?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_levels: {
        Row: {
          age_range: string | null
          class: string | null
          created_at: string
          division_group: string | null
          division_url: string | null
          division_uuid: string | null
          exclude_scores_from_vtv: boolean
          gender: string | null
          hide_from_leaderboard: boolean
          hide_from_website: boolean
          id: string
          international_level: boolean
          international_united_scoring_level: boolean
          is_8_categories_level: boolean
          is_active: boolean
          is_crowd_leading: boolean
          is_crowd_leading_non_building: boolean
          is_crowd_leading_non_tumbling: boolean
          is_game_day: boolean
          is_iasf_level: boolean
          is_international_global_level: boolean
          is_international_united_scoring: boolean
          is_junior: boolean
          is_mascot: boolean
          is_mini: boolean
          is_nda_duo_trio: boolean
          is_nda_game_day: boolean
          is_nda_school_hip_hop: boolean
          is_nda_school_jazz: boolean
          is_nda_school_kick: boolean
          is_nda_school_pom: boolean
          is_nda_school_team_performance: boolean
          is_nda_traditional_dance: boolean
          is_non_building: boolean
          is_non_tumbling: boolean
          is_prep: boolean
          is_school_performance: boolean
          is_tiny: boolean
          is_uca_game_day: boolean
          is_uca_intermediate_non_tumbling_routine: boolean
          is_uca_intermediate_routine: boolean
          is_uca_non_building_routine: boolean
          is_uca_non_tumbling_routine: boolean
          is_uca_performance_routine: boolean
          is_uca_uda_spirit_program: boolean
          is_uda_choreography_kick: boolean
          is_uda_execution_kick: boolean
          is_uda_game_day: boolean
          is_uda_kick: boolean
          is_uda_solo: boolean
          is_uda_traditional: boolean
          is_uda_traditional_choreography: boolean
          is_uda_traditional_execution: boolean
          is_world_level: boolean
          is_youth: boolean
          legacy_id: number | null
          level_desc: string | null
          level_number: string | null
          parent_division: string | null
          size: string | null
          updated_at: string
          use_icu_8_judge_scoring_template: boolean
          varsity_novice_level: boolean
          varsity_novice_tiny_level: boolean
        }
        Insert: {
          age_range?: string | null
          class?: string | null
          created_at?: string
          division_group?: string | null
          division_url?: string | null
          division_uuid?: string | null
          exclude_scores_from_vtv?: boolean
          gender?: string | null
          hide_from_leaderboard?: boolean
          hide_from_website?: boolean
          id?: string
          international_level?: boolean
          international_united_scoring_level?: boolean
          is_8_categories_level?: boolean
          is_active?: boolean
          is_crowd_leading?: boolean
          is_crowd_leading_non_building?: boolean
          is_crowd_leading_non_tumbling?: boolean
          is_game_day?: boolean
          is_iasf_level?: boolean
          is_international_global_level?: boolean
          is_international_united_scoring?: boolean
          is_junior?: boolean
          is_mascot?: boolean
          is_mini?: boolean
          is_nda_duo_trio?: boolean
          is_nda_game_day?: boolean
          is_nda_school_hip_hop?: boolean
          is_nda_school_jazz?: boolean
          is_nda_school_kick?: boolean
          is_nda_school_pom?: boolean
          is_nda_school_team_performance?: boolean
          is_nda_traditional_dance?: boolean
          is_non_building?: boolean
          is_non_tumbling?: boolean
          is_prep?: boolean
          is_school_performance?: boolean
          is_tiny?: boolean
          is_uca_game_day?: boolean
          is_uca_intermediate_non_tumbling_routine?: boolean
          is_uca_intermediate_routine?: boolean
          is_uca_non_building_routine?: boolean
          is_uca_non_tumbling_routine?: boolean
          is_uca_performance_routine?: boolean
          is_uca_uda_spirit_program?: boolean
          is_uda_choreography_kick?: boolean
          is_uda_execution_kick?: boolean
          is_uda_game_day?: boolean
          is_uda_kick?: boolean
          is_uda_solo?: boolean
          is_uda_traditional?: boolean
          is_uda_traditional_choreography?: boolean
          is_uda_traditional_execution?: boolean
          is_world_level?: boolean
          is_youth?: boolean
          legacy_id?: number | null
          level_desc?: string | null
          level_number?: string | null
          parent_division?: string | null
          size?: string | null
          updated_at?: string
          use_icu_8_judge_scoring_template?: boolean
          varsity_novice_level?: boolean
          varsity_novice_tiny_level?: boolean
        }
        Update: {
          age_range?: string | null
          class?: string | null
          created_at?: string
          division_group?: string | null
          division_url?: string | null
          division_uuid?: string | null
          exclude_scores_from_vtv?: boolean
          gender?: string | null
          hide_from_leaderboard?: boolean
          hide_from_website?: boolean
          id?: string
          international_level?: boolean
          international_united_scoring_level?: boolean
          is_8_categories_level?: boolean
          is_active?: boolean
          is_crowd_leading?: boolean
          is_crowd_leading_non_building?: boolean
          is_crowd_leading_non_tumbling?: boolean
          is_game_day?: boolean
          is_iasf_level?: boolean
          is_international_global_level?: boolean
          is_international_united_scoring?: boolean
          is_junior?: boolean
          is_mascot?: boolean
          is_mini?: boolean
          is_nda_duo_trio?: boolean
          is_nda_game_day?: boolean
          is_nda_school_hip_hop?: boolean
          is_nda_school_jazz?: boolean
          is_nda_school_kick?: boolean
          is_nda_school_pom?: boolean
          is_nda_school_team_performance?: boolean
          is_nda_traditional_dance?: boolean
          is_non_building?: boolean
          is_non_tumbling?: boolean
          is_prep?: boolean
          is_school_performance?: boolean
          is_tiny?: boolean
          is_uca_game_day?: boolean
          is_uca_intermediate_non_tumbling_routine?: boolean
          is_uca_intermediate_routine?: boolean
          is_uca_non_building_routine?: boolean
          is_uca_non_tumbling_routine?: boolean
          is_uca_performance_routine?: boolean
          is_uca_uda_spirit_program?: boolean
          is_uda_choreography_kick?: boolean
          is_uda_execution_kick?: boolean
          is_uda_game_day?: boolean
          is_uda_kick?: boolean
          is_uda_solo?: boolean
          is_uda_traditional?: boolean
          is_uda_traditional_choreography?: boolean
          is_uda_traditional_execution?: boolean
          is_world_level?: boolean
          is_youth?: boolean
          legacy_id?: number | null
          level_desc?: string | null
          level_number?: string | null
          parent_division?: string | null
          size?: string | null
          updated_at?: string
          use_icu_8_judge_scoring_template?: boolean
          varsity_novice_level?: boolean
          varsity_novice_tiny_level?: boolean
        }
        Relationships: []
      }
      teams: {
        Row: {
          athletes_female: number
          athletes_male: number
          coach_email: string | null
          coach_name: string | null
          coach_phone: string | null
          coach_user_id: string | null
          created_at: string
          division_id: string
          event_id: string
          gym_name: string
          id: string
          level_id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          athletes_female?: number
          athletes_male?: number
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          coach_user_id?: string | null
          created_at?: string
          division_id: string
          event_id: string
          gym_name: string
          id?: string
          level_id: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          athletes_female?: number
          athletes_male?: number
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          coach_user_id?: string | null
          created_at?: string
          division_id?: string
          event_id?: string
          gym_name?: string
          id?: string
          level_id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_submissions: {
        Row: {
          brightcove_video_id: string | null
          captured_at: string | null
          created_at: string
          device_info: Json | null
          duration_seconds: number | null
          event_id: string
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitted_by: string | null
          submitted_via: string
          team_id: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          brightcove_video_id?: string | null
          captured_at?: string | null
          created_at?: string
          device_info?: Json | null
          duration_seconds?: number | null
          event_id: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_via?: string
          team_id: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          brightcove_video_id?: string | null
          captured_at?: string | null
          created_at?: string
          device_info?: Json | null
          duration_seconds?: number | null
          event_id?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_via?: string
          team_id?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_mobile_sessions: { Args: never; Returns: undefined }
      cleanup_old_login_events: { Args: never; Returns: undefined }
      coach_account_status: {
        Args: { _event_id: string }
        Returns: {
          coach_email: string
          coach_name: string
          has_gym_coach_role: boolean
          team_count: number
          user_exists: boolean
          user_id: string
        }[]
      }
      generate_short_uuid: { Args: never; Returns: string }
      get_review_by_token: {
        Args: { review_token: string }
        Returns: {
          coach_email: string
          coach_name: string
          division_name: string
          event_name: string
          expires_at: string
          gym_name: string
          level_name: string
          scores: Json
          submission_status: string
          team_name: string
          thumbnail_url: string
          token_id: string
          token_status: string
          video_url: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_password: { Args: { _password: string }; Returns: string }
      legacy_session_lookup: {
        Args: { _token: string }
        Returns: {
          email: string
          full_name: string
          organization_name: string
          user_id: string
        }[]
      }
      mark_review_viewed: { Args: { review_token: string }; Returns: boolean }
      submit_review_request: {
        Args: { notes: string; review_token: string }
        Returns: boolean
      }
      verify_password: {
        Args: { _hash: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "judge"
        | "gym_coach"
        | "portal_admin"
        | "content_contributor"
      category_type: "main" | "difficulty" | "execution" | "driver"
      deduction_category: "athlete" | "building" | "rule_violation" | "legality"
      event_status:
        | "draft"
        | "registration_open"
        | "registration_closed"
        | "open_for_scoring"
        | "in_progress"
        | "completed"
        | "archived"
      score_status: "in_progress" | "submitted" | "locked"
      scoring_field_aggregation:
        | "average"
        | "trimmed_mean"
        | "min"
        | "max"
        | "sum"
      scoring_field_type:
        | "number"
        | "dropdown"
        | "difficulty_driver"
        | "execution_driver"
      submission_status:
        | "pending"
        | "uploaded"
        | "processing"
        | "ready"
        | "failed"
        | "imported"
        | "approved"
        | "denied"
        | "assigned"
        | "complete"
        | "revision_requested"
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
        "admin",
        "judge",
        "gym_coach",
        "portal_admin",
        "content_contributor",
      ],
      category_type: ["main", "difficulty", "execution", "driver"],
      deduction_category: ["athlete", "building", "rule_violation", "legality"],
      event_status: [
        "draft",
        "registration_open",
        "registration_closed",
        "open_for_scoring",
        "in_progress",
        "completed",
        "archived",
      ],
      score_status: ["in_progress", "submitted", "locked"],
      scoring_field_aggregation: [
        "average",
        "trimmed_mean",
        "min",
        "max",
        "sum",
      ],
      scoring_field_type: [
        "number",
        "dropdown",
        "difficulty_driver",
        "execution_driver",
      ],
      submission_status: [
        "pending",
        "uploaded",
        "processing",
        "ready",
        "failed",
        "imported",
        "approved",
        "denied",
        "assigned",
        "complete",
        "revision_requested",
      ],
    },
  },
} as const
