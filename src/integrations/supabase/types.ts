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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      briefing_requests: {
        Row: {
          created_at: string
          email: string
          government: string
          id: string
          message: string | null
          name: string
          nation: string
          role: string
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          government: string
          id?: string
          message?: string | null
          name: string
          nation: string
          role: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          government?: string
          id?: string
          message?: string | null
          name?: string
          nation?: string
          role?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          behavior: string
          created_at: string
          icon: string
          id: string
          is_builtin: boolean
          label: string
          media_modes: string[]
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          behavior: string
          created_at?: string
          icon?: string
          id?: string
          is_builtin?: boolean
          label: string
          media_modes?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          behavior?: string
          created_at?: string
          icon?: string
          id?: string
          is_builtin?: boolean
          label?: string
          media_modes?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          country_pack: Json
          created_at: string
          currency: string
          fiscal_year_start_month: number
          is_caricom: boolean
          is_cbi_state: boolean
          is_oecs: boolean
          iso3: string | null
          membership_tier: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          country_pack?: Json
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          is_caricom?: boolean
          is_cbi_state?: boolean
          is_oecs?: boolean
          iso3?: string | null
          membership_tier: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          country_pack?: Json
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          is_caricom?: boolean
          is_cbi_state?: boolean
          is_oecs?: boolean
          iso3?: string | null
          membership_tier?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      country_sectors: {
        Row: {
          confidence_grade: string
          country_code: string
          created_at: string
          sector_code: string
          share_pct: number
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          confidence_grade?: string
          country_code: string
          created_at?: string
          sector_code: string
          share_pct: number
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          confidence_grade?: string
          country_code?: string
          created_at?: string
          sector_code?: string
          share_pct?: number
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_sectors_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "country_sectors_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
      galleries: {
        Row: {
          category_id: string
          cover_url: string | null
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          created_at: string
          gallery_id: string
          id: string
          kind: string
          label: string | null
          media_asset_id: string | null
          sort_order: number
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          gallery_id: string
          id?: string
          kind: string
          label?: string | null
          media_asset_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          gallery_id?: string
          id?: string
          kind?: string
          label?: string | null
          media_asset_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      idle_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          media_asset_id: string | null
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          media_asset_id?: string | null
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          media_asset_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "idle_images_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          created_at: string
          favicon_asset_id: string | null
          favicon_url: string | null
          id: string
          label: string
          pdf_storage_path: string | null
          sort_order: number
          thumbnail_error: string | null
          thumbnail_status: string
          thumbnail_updated_at: string | null
          thumbnail_url: string | null
          tooltip: string | null
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          favicon_asset_id?: string | null
          favicon_url?: string | null
          id?: string
          label: string
          pdf_storage_path?: string | null
          sort_order?: number
          thumbnail_error?: string | null
          thumbnail_status?: string
          thumbnail_updated_at?: string | null
          thumbnail_url?: string | null
          tooltip?: string | null
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          favicon_asset_id?: string | null
          favicon_url?: string | null
          id?: string
          label?: string
          pdf_storage_path?: string | null
          sort_order?: number
          thumbnail_error?: string | null
          thumbnail_status?: string
          thumbnail_updated_at?: string | null
          thumbnail_url?: string | null
          tooltip?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_favicon_asset_id_fkey"
            columns: ["favicon_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string
          filename: string
          id: string
          kind: string
          mime_type: string
          public_url: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          kind: string
          mime_type: string
          public_url: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          kind?: string
          mime_type?: string
          public_url?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          code: string
          hue_token: string
          index: number
          isic: string | null
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          hue_token: string
          index: number
          isic?: string | null
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          hue_token?: string
          index?: number
          isic?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      sources: {
        Row: {
          country_code: string | null
          created_at: string
          grade: string
          id: string
          kind: string
          name: string
          sector_code: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          grade?: string
          id?: string
          kind: string
          name: string
          sector_code?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          grade?: string
          id?: string
          kind?: string
          name?: string
          sector_code?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sources_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "principal"
        | "steward"
        | "advisor"
        | "line_minister"
        | "comms_director"
        | "cabinet_secretary"
        | "data_steward"
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
        "principal",
        "steward",
        "advisor",
        "line_minister",
        "comms_director",
        "cabinet_secretary",
        "data_steward",
      ],
    },
  },
} as const
