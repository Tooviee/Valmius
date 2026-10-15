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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      decision_log: {
        Row: {
          actor_name: string
          created_by: string | null
          decision: string
          exercise_id: string
          id: string
          inject_index: number | null
          logged_at: string
          notes: string
        }
        Insert: {
          actor_name: string
          created_by?: string | null
          decision: string
          exercise_id: string
          id?: string
          inject_index?: number | null
          logged_at?: string
          notes?: string
        }
        Update: {
          actor_name?: string
          created_by?: string | null
          decision?: string
          exercise_id?: string
          id?: string
          inject_index?: number | null
          logged_at?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_log_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: number
          ip_hash: string | null
          name: string
          org_id: string | null
          properties: Json
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          name: string
          org_id?: string | null
          properties?: Json
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          name?: string
          org_id?: string | null
          properties?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_participants: {
        Row: {
          attended_at: string | null
          created_at: string
          email: string | null
          exercise_id: string
          id: string
          name: string
          role: string
          signature_name: string | null
          signed_off_at: string | null
          token: string
        }
        Insert: {
          attended_at?: string | null
          created_at?: string
          email?: string | null
          exercise_id: string
          id?: string
          name: string
          role: string
          signature_name?: string | null
          signed_off_at?: string | null
          token: string
        }
        Update: {
          attended_at?: string | null
          created_at?: string
          email?: string | null
          exercise_id?: string
          id?: string
          name?: string
          role?: string
          signature_name?: string | null
          signed_off_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_participants_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          ended_at: string | null
          facilitator_id: string | null
          id: string
          ir_plan_id: string | null
          org_id: string
          parking_lot: string
          reveal_times: string[]
          revealed_count: number
          scenario_id: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          facilitator_id?: string | null
          id?: string
          ir_plan_id?: string | null
          org_id: string
          parking_lot?: string
          reveal_times?: string[]
          revealed_count?: number
          scenario_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          facilitator_id?: string | null
          id?: string
          ir_plan_id?: string | null
          org_id?: string
          parking_lot?: string
          reveal_times?: string[]
          revealed_count?: number
          scenario_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_ir_plan_id_fkey"
            columns: ["ir_plan_id"]
            isOneToOne: false
            referencedRelation: "ir_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          exercise_id: string
          id: string
          kind: string
          owner_name: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          exercise_id: string
          id?: string
          kind: string
          owner_name?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          exercise_id?: string
          id?: string
          kind?: string
          owner_name?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_plans: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          questionnaire_id: string
          sections: Json
          status: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          questionnaire_id: string
          sections: Json
          status?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          questionnaire_id?: string
          sections?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ir_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_plans_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          headcount_band: string | null
          id: string
          industry: string | null
          scenario_type: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          headcount_band?: string | null
          id?: string
          industry?: string | null
          scenario_type?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          headcount_band?: string | null
          id?: string
          industry?: string | null
          scenario_type?: string | null
          source?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          frameworks: string[]
          headcount_band: string
          id: string
          industry: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          created_by: string
          frameworks?: string[]
          headcount_band: string
          id?: string
          industry: string
          name: string
          timezone: string
        }
        Update: {
          created_at?: string
          created_by?: string
          frameworks?: string[]
          headcount_band?: string
          id?: string
          industry?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          exercise_id: string
          finalized_at: string | null
          generated_at: string
          id: string
          org_id: string
          pdf_path: string | null
          sha256: string | null
          status: string
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          exercise_id: string
          finalized_at?: string | null
          generated_at?: string
          id?: string
          org_id: string
          pdf_path?: string | null
          sha256?: string | null
          status?: string
          version: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          exercise_id?: string
          finalized_at?: string | null
          generated_at?: string
          id?: string
          org_id?: string
          pdf_path?: string | null
          sha256?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          content: Json
          created_at: string
          framework_tags: string[]
          id: string
          is_pack: boolean
          org_id: string | null
          title: string
          type: string
        }
        Insert: {
          content: Json
          created_at?: string
          framework_tags?: string[]
          id?: string
          is_pack?: boolean
          org_id?: string | null
          title: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string
          framework_tags?: string[]
          id?: string
          is_pack?: boolean
          org_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
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
      bump_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_organization: {
        Args: {
          p_frameworks: string[]
          p_headcount_band: string
          p_industry: string
          p_name: string
          p_timezone: string
        }
        Returns: string
      }
      event_counts_by_day: {
        Args: { p_since: string }
        Returns: {
          count: number
          day: string
          name: string
        }[]
      }
      is_exercise_member: { Args: { p_exercise_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { p_org_id: string }; Returns: boolean }
      purge_stale_rate_limits: { Args: never; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
