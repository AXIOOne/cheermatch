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
      divisions: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          max_age: number | null
          min_age: number | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          name: string
          registration_deadline: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          registration_deadline: string
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          registration_deadline?: string
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
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
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          event_id: string
          id?: string
          judge_user_id: string
          level_id?: string | null
        }
        Update: {
          created_at?: string
          division_id?: string | null
          event_id?: string
          id?: string
          judge_user_id?: string
          level_id?: string | null
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
        ]
      }
      levels: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          level_number: number
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          level_number: number
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          level_number?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          email: string
          full_name: string | null
          id: string
          organization_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          organization_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          organization_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      score_details: {
        Row: {
          category_id: string
          created_at: string
          id: string
          notes: string | null
          points: number
          score_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          notes?: string | null
          points: number
          score_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          points?: number
          score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_details_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "scoring_categories"
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
      scores: {
        Row: {
          comments: string | null
          created_at: string
          deductions: number | null
          id: string
          judge_user_id: string
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
          status?: Database["public"]["Enums"]["score_status"]
          submission_id?: string
          submitted_at?: string | null
          template_id?: string
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
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
      scoring_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          max_points: number
          name: string
          template_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_points: number
          name: string
          template_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_points?: number
          name?: string
          template_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_categories_template_id_fkey"
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
      scoring_templates: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_default?: boolean
          name?: string
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
      teams: {
        Row: {
          athlete_count: number
          coach_user_id: string
          created_at: string
          division_id: string
          event_id: string
          gym_name: string
          id: string
          level_id: string
          name: string
          updated_at: string
        }
        Insert: {
          athlete_count: number
          coach_user_id: string
          created_at?: string
          division_id: string
          event_id: string
          gym_name: string
          id?: string
          level_id: string
          name: string
          updated_at?: string
        }
        Update: {
          athlete_count?: number
          coach_user_id?: string
          created_at?: string
          division_id?: string
          event_id?: string
          gym_name?: string
          id?: string
          level_id?: string
          name?: string
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
          created_at: string
          duration_seconds: number | null
          event_id: string
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitted_by: string | null
          team_id: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          brightcove_video_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          event_id: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          team_id: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          brightcove_video_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          event_id?: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
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
      mark_review_viewed: { Args: { review_token: string }; Returns: boolean }
      submit_review_request: {
        Args: { notes: string; review_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "judge" | "gym_coach"
      event_status:
        | "draft"
        | "registration_open"
        | "registration_closed"
        | "in_progress"
        | "completed"
        | "archived"
      score_status: "in_progress" | "submitted" | "locked"
      submission_status:
        | "pending"
        | "uploaded"
        | "processing"
        | "ready"
        | "failed"
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
      app_role: ["admin", "judge", "gym_coach"],
      event_status: [
        "draft",
        "registration_open",
        "registration_closed",
        "in_progress",
        "completed",
        "archived",
      ],
      score_status: ["in_progress", "submitted", "locked"],
      submission_status: [
        "pending",
        "uploaded",
        "processing",
        "ready",
        "failed",
      ],
    },
  },
} as const
