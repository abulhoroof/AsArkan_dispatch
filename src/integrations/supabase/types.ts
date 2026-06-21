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
      driver_reassignment_history: {
        Row: {
          created_at: string
          driver_id: string
          driver_name: string
          from_dispatcher_email: string | null
          from_dispatcher_id: string | null
          id: string
          loads_transferred: number | null
          notes: string | null
          organization_id: string | null
          reassigned_by: string
          to_dispatcher_email: string
          to_dispatcher_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          driver_name: string
          from_dispatcher_email?: string | null
          from_dispatcher_id?: string | null
          id?: string
          loads_transferred?: number | null
          notes?: string | null
          organization_id?: string | null
          reassigned_by: string
          to_dispatcher_email: string
          to_dispatcher_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          driver_name?: string
          from_dispatcher_email?: string | null
          from_dispatcher_id?: string | null
          id?: string
          loads_transferred?: number | null
          notes?: string | null
          organization_id?: string | null
          reassigned_by?: string
          to_dispatcher_email?: string
          to_dispatcher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_reassignment_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_reassignment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_statuses: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          nr: number
          organization_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          nr: number
          organization_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          nr?: number
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_statuses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string | null
          driver_id: string
          id: string
          load_id: string | null
          organization_id: string
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          driver_id: string
          id?: string
          load_id?: string | null
          organization_id: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          driver_id?: string
          id?: string
          load_id?: string | null
          organization_id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          assigned_at: string | null
          assigned_dispatcher_id: string | null
          contract_type: string
          created_at: string
          current_location_override: string | null
          current_location_override_set_at: string | null
          driver_name: string
          driver_phone: string | null
          fuel_enabled: boolean
          id: string
          is_deleted: boolean | null
          organization_id: string
          trailer_number: string | null
          trailer_type: string | null
          truck_number: number | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_dispatcher_id?: string | null
          contract_type?: string
          created_at?: string
          current_location_override?: string | null
          current_location_override_set_at?: string | null
          driver_name: string
          driver_phone?: string | null
          fuel_enabled?: boolean
          id?: string
          is_deleted?: boolean | null
          organization_id: string
          trailer_number?: string | null
          trailer_type?: string | null
          truck_number?: number | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_dispatcher_id?: string | null
          contract_type?: string
          created_at?: string
          current_location_override?: string | null
          current_location_override_set_at?: string | null
          driver_name?: string
          driver_phone?: string | null
          fuel_enabled?: boolean
          id?: string
          is_deleted?: boolean | null
          organization_id?: string
          trailer_number?: string | null
          trailer_type?: string | null
          truck_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          admin_role: boolean
          created_at: string
          email: string
          id: string
          organization_id: string
          used: boolean
        }
        Insert: {
          admin_role?: boolean
          created_at?: string
          email: string
          id?: string
          organization_id: string
          used?: boolean
        }
        Update: {
          admin_role?: boolean
          created_at?: string
          email?: string
          id?: string
          organization_id?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          accounting_notes: string | null
          accounting_notes_admin: string | null
          available_on: string | null
          contract_type: string
          created_at: string
          delivery_date: string | null
          delivery_location: string | null
          dh_miles: number | null
          driver_id: string
          driver_name: string
          driver_pay: number | null
          driver_pay_manually_edited: boolean | null
          driver_phone: string | null
          extra_stops_count: number
          id: string
          invoiced: string | null
          is_archived: boolean | null
          is_deleted: boolean | null
          load_amount: number | null
          load_number: string | null
          nr: number
          organization_id: string
          paid_at: string | null
          pay_status: string
          pick_up_date: string | null
          pick_up_location: string | null
          rpm: number | null
          status: string | null
          tarp_status: string | null
          total_miles: number | null
          trailer_number: string | null
          trailer_type: string | null
          trip_miles: number | null
          truck_number: number | null
          updated_at: string
          user_id: string
          verified: boolean | null
          zip_code: string | null
        }
        Insert: {
          accounting_notes?: string | null
          accounting_notes_admin?: string | null
          available_on?: string | null
          contract_type: string
          created_at?: string
          delivery_date?: string | null
          delivery_location?: string | null
          dh_miles?: number | null
          driver_id?: string
          driver_name: string
          driver_pay?: number | null
          driver_pay_manually_edited?: boolean | null
          driver_phone?: string | null
          extra_stops_count?: number
          id?: string
          invoiced?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          load_amount?: number | null
          load_number?: string | null
          nr: number
          organization_id: string
          paid_at?: string | null
          pay_status?: string
          pick_up_date?: string | null
          pick_up_location?: string | null
          rpm?: number | null
          status?: string | null
          tarp_status?: string | null
          total_miles?: number | null
          trailer_number?: string | null
          trailer_type?: string | null
          trip_miles?: number | null
          truck_number?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          zip_code?: string | null
        }
        Update: {
          accounting_notes?: string | null
          accounting_notes_admin?: string | null
          available_on?: string | null
          contract_type?: string
          created_at?: string
          delivery_date?: string | null
          delivery_location?: string | null
          dh_miles?: number | null
          driver_id?: string
          driver_name?: string
          driver_pay?: number | null
          driver_pay_manually_edited?: boolean | null
          driver_phone?: string | null
          extra_stops_count?: number
          id?: string
          invoiced?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          load_amount?: number | null
          load_number?: string | null
          nr?: number
          organization_id?: string
          paid_at?: string | null
          pay_status?: string
          pick_up_date?: string | null
          pick_up_location?: string | null
          rpm?: number | null
          status?: string | null
          tarp_status?: string | null
          total_miles?: number | null
          trailer_number?: string | null
          trailer_type?: string | null
          trip_miles?: number | null
          truck_number?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          organization_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          organization_id?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settlement_history: {
        Row: {
          created_at: string
          deductions: Json | null
          driver_contract_type: string
          driver_id: string
          driver_name: string
          generated_at: string
          generated_by: string
          grand_total: number | null
          id: string
          line_items: Json | null
          organization_id: string
          period_end: string
          period_start: string
          reimbursements: Json | null
          total_deductions: number | null
          total_loads: number | null
          total_reimbursements: number | null
        }
        Insert: {
          created_at?: string
          deductions?: Json | null
          driver_contract_type: string
          driver_id: string
          driver_name: string
          generated_at?: string
          generated_by: string
          grand_total?: number | null
          id?: string
          line_items?: Json | null
          organization_id: string
          period_end: string
          period_start: string
          reimbursements?: Json | null
          total_deductions?: number | null
          total_loads?: number | null
          total_reimbursements?: number | null
        }
        Update: {
          created_at?: string
          deductions?: Json | null
          driver_contract_type?: string
          driver_id?: string
          driver_name?: string
          generated_at?: string
          generated_by?: string
          grand_total?: number | null
          id?: string
          line_items?: Json | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reimbursements?: Json | null
          total_deductions?: number | null
          total_loads?: number | null
          total_reimbursements?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          created_by: string
          deductions: Json | null
          driver_id: string
          finalized_at: string | null
          finalized_by: string | null
          grand_total: number | null
          id: string
          invoice_number: string
          line_items: Json | null
          organization_id: string
          period_end: string
          period_start: string
          reimbursements: Json | null
          status: string
          total_deductions: number | null
          total_loads: number | null
          total_reimbursements: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deductions?: Json | null
          driver_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          grand_total?: number | null
          id?: string
          invoice_number: string
          line_items?: Json | null
          organization_id: string
          period_end: string
          period_start: string
          reimbursements?: Json | null
          status?: string
          total_deductions?: number | null
          total_loads?: number | null
          total_reimbursements?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deductions?: Json | null
          driver_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          grand_total?: number | null
          id?: string
          invoice_number?: string
          line_items?: Json | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reimbursements?: Json | null
          status?: string
          total_deductions?: number | null
          total_loads?: number | null
          total_reimbursements?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_organization_id_fkey"
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
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_codes: {
        Row: {
          city: string
          county_name: string
          created_at: string
          id: string
          lat: number
          lng: number
          state_id: string
          state_name: string
          timezone: string
          zip: string
        }
        Insert: {
          city: string
          county_name: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          state_id: string
          state_name: string
          timezone: string
          zip: string
        }
        Update: {
          city?: string
          county_name?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          state_id?: string
          state_name?: string
          timezone?: string
          zip?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_dispatchers:
        | {
            Args: never
            Returns: {
              email: string
              id: string
              name: string
              role: string
            }[]
          }
        | {
            Args: { p_org_id?: string }
            Returns: {
              email: string
              id: string
              name: string
              role: string
            }[]
          }
      get_all_drivers: {
        Args: never
        Returns: {
          contract_type: string
          driver_id: string
          driver_name: string
          driver_phone: string
        }[]
      }
      get_all_drivers_with_dispatchers:
        | {
            Args: never
            Returns: {
              assigned_dispatcher_id: string
              available_on: string
              contract_type: string
              delivery_location: string
              dispatcher_email: string
              driver_id: string
              driver_name: string
              driver_phone: string
              fuel_enabled: boolean
              nr: number
              pick_up_location: string
              previous_delivery_location: string
              status: string
              trailer_number: string
              trailer_type: string
              truck_number: number
            }[]
          }
        | {
            Args: { p_org_id?: string }
            Returns: {
              assigned_dispatcher_id: string
              available_on: string
              contract_type: string
              delivery_location: string
              dispatcher_email: string
              driver_id: string
              driver_name: string
              driver_phone: string
              fuel_enabled: boolean
              nr: number
              pick_up_location: string
              previous_delivery_location: string
              status: string
              trailer_number: string
              trailer_type: string
              truck_number: number
            }[]
          }
      get_dispatcher_performance:
        | {
            Args: never
            Returns: {
              avg_rpm: number
              avg_turnaround_days: number
              dispatcher_email: string
              dispatcher_name: string
              invoiced_loads: number
              profit: number
              profit_margin: number
              total_driver_pay: number
              total_loads: number
              total_miles: number
              total_revenue: number
              verified_loads: number
            }[]
          }
        | {
            Args: { p_org_id?: string }
            Returns: {
              avg_rpm: number
              avg_turnaround_days: number
              dispatcher_email: string
              dispatcher_name: string
              invoiced_loads: number
              profit: number
              profit_margin: number
              total_driver_pay: number
              total_loads: number
              total_miles: number
              total_revenue: number
              verified_loads: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_org_id?: string
              p_start_date?: string
            }
            Returns: {
              avg_rpm: number
              avg_turnaround_days: number
              dispatcher_email: string
              dispatcher_name: string
              invoiced_loads: number
              profit: number
              profit_margin: number
              total_driver_pay: number
              total_loads: number
              total_miles: number
              total_revenue: number
              verified_loads: number
            }[]
          }
      get_driver_statement: {
        Args: {
          p_driver_id: string
          p_end_date: string
          p_org_id?: string
          p_start_date: string
        }
        Returns: {
          contract_type: string
          driver_id: string
          driver_name: string
          net_payment: number
          total_deductions: number
          total_driver_pay: number
          total_load_amount: number
          total_loads: number
          total_reimbursements: number
          truck_number: number
        }[]
      }
      get_incoming_drivers: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: {
          current_location: string
          driver_id: string
          driver_name: string
          estimated_available_date: string
          external_load_count: number
          old_dispatcher_id: string
          old_dispatcher_name: string
        }[]
      }
      get_loads_with_dispatcher:
        | {
            Args: never
            Returns: {
              dispatcher_email: string
              dispatcher_id: string
              dispatcher_name: string
              load_id: string
            }[]
          }
        | {
            Args: { p_org_id?: string }
            Returns: {
              dispatcher_email: string
              dispatcher_id: string
              dispatcher_name: string
              load_id: string
            }[]
          }
      get_organization_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      get_sunset_loads: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: {
          accounting_notes: string
          delivery_date: string
          delivery_location: string
          driver_id: string
          driver_name: string
          driver_pay: number
          invoiced: string
          load_amount: number
          load_id: string
          load_number: string
          new_dispatcher_id: string
          new_dispatcher_name: string
          pick_up_date: string
          pick_up_location: string
          status: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_of_org: { Args: { org_id: string }; Returns: boolean }
      is_org_admin: { Args: never; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "dispatcher"
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
      app_role: ["admin", "dispatcher"],
    },
  },
} as const
