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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          id: string
          metadata: Json
          scope_key: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          scope_key?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          scope_key?: string | null
          target_id?: string | null
          target_type?: string | null
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
      cabinet_agenda_items: {
        Row: {
          brief_md: string | null
          classification: string
          country_code: string
          created_at: string
          created_by: string | null
          dossier: Json
          id: string
          motion_kind: string
          ordinal: number
          readiness_score: number
          recommendation: string | null
          session_id: string
          sponsor_ministry_id: string | null
          status: string
          time_box_min: number
          title: string
          updated_at: string
        }
        Insert: {
          brief_md?: string | null
          classification?: string
          country_code: string
          created_at?: string
          created_by?: string | null
          dossier?: Json
          id?: string
          motion_kind?: string
          ordinal?: number
          readiness_score?: number
          recommendation?: string | null
          session_id: string
          sponsor_ministry_id?: string | null
          status?: string
          time_box_min?: number
          title: string
          updated_at?: string
        }
        Update: {
          brief_md?: string | null
          classification?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          dossier?: Json
          id?: string
          motion_kind?: string
          ordinal?: number
          readiness_score?: number
          recommendation?: string | null
          session_id?: string
          sponsor_ministry_id?: string | null
          status?: string
          time_box_min?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_agenda_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cabinet_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_agenda_items_sponsor_ministry_id_fkey"
            columns: ["sponsor_ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_attendance: {
        Row: {
          attendee_name: string
          country_code: string
          created_at: string
          id: string
          is_chair: boolean
          present: boolean
          role: string | null
          session_id: string
        }
        Insert: {
          attendee_name: string
          country_code: string
          created_at?: string
          id?: string
          is_chair?: boolean
          present?: boolean
          role?: string | null
          session_id: string
        }
        Update: {
          attendee_name?: string
          country_code?: string
          created_at?: string
          id?: string
          is_chair?: boolean
          present?: boolean
          role?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cabinet_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_brief_cache: {
        Row: {
          brief_md: string
          citations: Json
          country_code: string
          generated_at: string
          generated_by: string | null
          headline: string | null
          id: string
          model: string | null
          posture: Json
        }
        Insert: {
          brief_md: string
          citations?: Json
          country_code: string
          generated_at?: string
          generated_by?: string | null
          headline?: string | null
          id?: string
          model?: string | null
          posture?: Json
        }
        Update: {
          brief_md?: string
          citations?: Json
          country_code?: string
          generated_at?: string
          generated_by?: string | null
          headline?: string | null
          id?: string
          model?: string | null
          posture?: Json
        }
        Relationships: []
      }
      cabinet_sessions: {
        Row: {
          agenda: Json
          chair_name: string | null
          chair_signed_at: string | null
          classification: string
          closed_at: string | null
          country_code: string
          created_at: string
          created_by: string | null
          held_at: string | null
          id: string
          minutes: string | null
          scheduled_for: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: Json
          chair_name?: string | null
          chair_signed_at?: string | null
          classification?: string
          closed_at?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          held_at?: string | null
          id?: string
          minutes?: string | null
          scheduled_for?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: Json
          chair_name?: string | null
          chair_signed_at?: string | null
          classification?: string
          closed_at?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          held_at?: string | null
          id?: string
          minutes?: string | null
          scheduled_for?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cabinet_votes: {
        Row: {
          abstain_count: number
          against_count: number
          agenda_item_id: string
          country_code: string
          created_at: string
          for_count: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          abstain_count?: number
          against_count?: number
          agenda_item_id: string
          country_code: string
          created_at?: string
          for_count?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          abstain_count?: number
          against_count?: number
          agenda_item_id?: string
          country_code?: string
          created_at?: string
          for_count?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_votes_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: true
            referencedRelation: "cabinet_agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_closes: {
        Row: {
          closed_at: string
          closed_by: string | null
          id: string
          notes: string | null
          period_label: string
          snapshot_count: number
          window_kind: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          notes?: string | null
          period_label: string
          snapshot_count?: number
          window_kind: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          notes?: string | null
          period_label?: string
          snapshot_count?: number
          window_kind?: string
        }
        Relationships: []
      }
      capital_flow_nodes: {
        Row: {
          created_at: string
          description: string | null
          gdp_cap_multiplier: number
          hue_token: string | null
          label: string
          node_key: string
          preferred_sources: string[]
          sector_code: string | null
          side: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gdp_cap_multiplier?: number
          hue_token?: string | null
          label: string
          node_key: string
          preferred_sources?: string[]
          sector_code?: string | null
          side: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gdp_cap_multiplier?: number
          hue_token?: string | null
          label?: string
          node_key?: string
          preferred_sources?: string[]
          sector_code?: string | null
          side?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      capital_flow_research_attempts: {
        Row: {
          confidence_grade: string | null
          country_code: string
          created_at: string
          error: string | null
          evidence: Json
          formula: string | null
          id: string
          method: string | null
          node_key: string
          owner_country_code: string | null
          pass: string
          period: string | null
          provider: string
          run_id: string | null
          source_kind: string | null
          source_org: string | null
          source_url: string | null
          status: string
          uploaded_by: string | null
          validation: Json
          value_usd_m: number | null
          visibility: string
        }
        Insert: {
          confidence_grade?: string | null
          country_code: string
          created_at?: string
          error?: string | null
          evidence?: Json
          formula?: string | null
          id?: string
          method?: string | null
          node_key: string
          owner_country_code?: string | null
          pass: string
          period?: string | null
          provider: string
          run_id?: string | null
          source_kind?: string | null
          source_org?: string | null
          source_url?: string | null
          status?: string
          uploaded_by?: string | null
          validation?: Json
          value_usd_m?: number | null
          visibility?: string
        }
        Update: {
          confidence_grade?: string | null
          country_code?: string
          created_at?: string
          error?: string | null
          evidence?: Json
          formula?: string | null
          id?: string
          method?: string | null
          node_key?: string
          owner_country_code?: string | null
          pass?: string
          period?: string | null
          provider?: string
          run_id?: string | null
          source_kind?: string | null
          source_org?: string | null
          source_url?: string | null
          status?: string
          uploaded_by?: string | null
          validation?: Json
          value_usd_m?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_flow_research_attempts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "onboarding_runs"
            referencedColumns: ["id"]
          },
        ]
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
      citations: {
        Row: {
          bucket: string | null
          created_at: string
          created_by: string
          id: string
          memory_object_id: string | null
          owner_country_code: string | null
          owner_id: string
          owner_type: string
          position_offset: number | null
          quote: string | null
          scope_key: string
          sector_code: string | null
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          bucket?: string | null
          created_at?: string
          created_by: string
          id?: string
          memory_object_id?: string | null
          owner_country_code?: string | null
          owner_id: string
          owner_type: string
          position_offset?: number | null
          quote?: string | null
          scope_key: string
          sector_code?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          bucket?: string | null
          created_at?: string
          created_by?: string
          id?: string
          memory_object_id?: string | null
          owner_country_code?: string | null
          owner_id?: string
          owner_type?: string
          position_offset?: number | null
          quote?: string | null
          scope_key?: string
          sector_code?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "citations_memory_object_id_fkey"
            columns: ["memory_object_id"]
            isOneToOne: false
            referencedRelation: "memory_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          agenda_item_id: string | null
          country_code: string
          created_at: string
          created_by: string | null
          decision_id: string | null
          due_at: string | null
          id: string
          ministry_id: string | null
          owner_id: string | null
          sector_code: string | null
          status: string
          success_metric: string | null
          title: string
        }
        Insert: {
          agenda_item_id?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          id?: string
          ministry_id?: string | null
          owner_id?: string | null
          sector_code?: string | null
          status?: string
          success_metric?: string | null
          title: string
        }
        Update: {
          agenda_item_id?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          id?: string
          ministry_id?: string | null
          owner_id?: string | null
          sector_code?: string | null
          status?: string
          success_metric?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "cabinet_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_artifact_revisions: {
        Row: {
          artifact_id: string
          body: string
          edited_at: string
          editor_id: string | null
          id: string
          scope_key: string
          title: string | null
        }
        Insert: {
          artifact_id: string
          body: string
          edited_at?: string
          editor_id?: string | null
          id?: string
          scope_key: string
          title?: string | null
        }
        Update: {
          artifact_id?: string
          body?: string
          edited_at?: string
          editor_id?: string | null
          id?: string
          scope_key?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_artifact_revisions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "comms_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_artifacts: {
        Row: {
          approvals: Json
          assigned_reviewers: string[] | null
          audience: string
          body: string
          channel: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          draft_state: string
          id: string
          is_template: boolean
          kind: string
          published_at: string | null
          published_url: string | null
          released_at: string | null
          scheduled_for: string | null
          scope_key: string
          signal_id: string | null
          strategy_id: string | null
          tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          approvals?: Json
          assigned_reviewers?: string[] | null
          audience: string
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          draft_state?: string
          id?: string
          is_template?: boolean
          kind: string
          published_at?: string | null
          published_url?: string | null
          released_at?: string | null
          scheduled_for?: string | null
          scope_key: string
          signal_id?: string | null
          strategy_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          approvals?: Json
          assigned_reviewers?: string[] | null
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          draft_state?: string
          id?: string
          is_template?: boolean
          kind?: string
          published_at?: string | null
          published_url?: string | null
          released_at?: string | null
          scheduled_for?: string | null
          scope_key?: string
          signal_id?: string | null
          strategy_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_artifacts_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategy_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      corpus_fetch_attempts: {
        Row: {
          actor: string | null
          country_code: string
          created_at: string
          credits: number | null
          domain: string
          id: string
          key: string
          latency_ms: number | null
          notes: Json | null
          outcome: string
          tier: string | null
        }
        Insert: {
          actor?: string | null
          country_code: string
          created_at?: string
          credits?: number | null
          domain: string
          id?: string
          key: string
          latency_ms?: number | null
          notes?: Json | null
          outcome: string
          tier?: string | null
        }
        Update: {
          actor?: string | null
          country_code?: string
          created_at?: string
          credits?: number | null
          domain?: string
          id?: string
          key?: string
          latency_ms?: number | null
          notes?: Json | null
          outcome?: string
          tier?: string | null
        }
        Relationships: []
      }
      counsel_answers: {
        Row: {
          citations: Json
          content_hash: string
          created_at: string
          id: string
          question: string
          scenario_snapshot: Json | null
          scope_key: string
          spoken_block: string | null
          tags: Json
          user_id: string
          written_block: string | null
        }
        Insert: {
          citations?: Json
          content_hash: string
          created_at?: string
          id?: string
          question: string
          scenario_snapshot?: Json | null
          scope_key: string
          spoken_block?: string | null
          tags?: Json
          user_id: string
          written_block?: string | null
        }
        Update: {
          citations?: Json
          content_hash?: string
          created_at?: string
          id?: string
          question?: string
          scenario_snapshot?: Json | null
          scope_key?: string
          spoken_block?: string | null
          tags?: Json
          user_id?: string
          written_block?: string | null
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
          gdp_committed_at: string | null
          gdp_current_usd: number | null
          gdp_year: number | null
          is_caricom: boolean
          is_cbi_state: boolean
          is_oecs: boolean
          iso3: string | null
          membership_tier: string
          name: string
          profile_committed_at: string | null
          signature_generated_at: string | null
          signature_json: Json | null
          updated_at: string
        }
        Insert: {
          code: string
          country_pack?: Json
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          gdp_committed_at?: string | null
          gdp_current_usd?: number | null
          gdp_year?: number | null
          is_caricom?: boolean
          is_cbi_state?: boolean
          is_oecs?: boolean
          iso3?: string | null
          membership_tier: string
          name: string
          profile_committed_at?: string | null
          signature_generated_at?: string | null
          signature_json?: Json | null
          updated_at?: string
        }
        Update: {
          code?: string
          country_pack?: Json
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          gdp_committed_at?: string | null
          gdp_current_usd?: number | null
          gdp_year?: number | null
          is_caricom?: boolean
          is_cbi_state?: boolean
          is_oecs?: boolean
          iso3?: string | null
          membership_tier?: string
          name?: string
          profile_committed_at?: string | null
          signature_generated_at?: string | null
          signature_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      country_access_requests: {
        Row: {
          country_code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_access_requests_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      country_authorized_domains: {
        Row: {
          citation_count: number
          country_code: string
          created_at: string
          demoted_at: string | null
          domain: string
          first_seen_stage: string | null
          id: string
          last_used_at: string
          tier: string
        }
        Insert: {
          citation_count?: number
          country_code: string
          created_at?: string
          demoted_at?: string | null
          domain: string
          first_seen_stage?: string | null
          id?: string
          last_used_at?: string
          tier: string
        }
        Update: {
          citation_count?: number
          country_code?: string
          created_at?: string
          demoted_at?: string | null
          domain?: string
          first_seen_stage?: string | null
          id?: string
          last_used_at?: string
          tier?: string
        }
        Relationships: []
      }
      country_capital_flows: {
        Row: {
          citations: Json
          confidence_grade: string
          country_code: string
          created_at: string
          id: string
          method: string
          node_key: string
          notes: string | null
          owner_country_code: string | null
          period: string
          provenance: string
          updated_at: string
          uploaded_by: string | null
          value_usd_m: number
          visibility: string
        }
        Insert: {
          citations?: Json
          confidence_grade?: string
          country_code: string
          created_at?: string
          id?: string
          method?: string
          node_key: string
          notes?: string | null
          owner_country_code?: string | null
          period: string
          provenance?: string
          updated_at?: string
          uploaded_by?: string | null
          value_usd_m: number
          visibility?: string
        }
        Update: {
          citations?: Json
          confidence_grade?: string
          country_code?: string
          created_at?: string
          id?: string
          method?: string
          node_key?: string
          notes?: string | null
          owner_country_code?: string | null
          period?: string
          provenance?: string
          updated_at?: string
          uploaded_by?: string | null
          value_usd_m?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_capital_flows_node_key_fkey"
            columns: ["node_key"]
            isOneToOne: false
            referencedRelation: "capital_flow_nodes"
            referencedColumns: ["node_key"]
          },
        ]
      }
      country_kpi_points: {
        Row: {
          country_kpi_id: string
          created_at: string
          id: string
          owner_country_code: string | null
          period: string
          source_id: string | null
          source_url: string | null
          uploaded_by: string | null
          value: number
          visibility: string
        }
        Insert: {
          country_kpi_id: string
          created_at?: string
          id?: string
          owner_country_code?: string | null
          period: string
          source_id?: string | null
          source_url?: string | null
          uploaded_by?: string | null
          value: number
          visibility?: string
        }
        Update: {
          country_kpi_id?: string
          created_at?: string
          id?: string
          owner_country_code?: string | null
          period?: string
          source_id?: string | null
          source_url?: string | null
          uploaded_by?: string | null
          value?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_kpi_points_country_kpi_id_fkey"
            columns: ["country_kpi_id"]
            isOneToOne: false
            referencedRelation: "country_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_kpi_points_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "country_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      country_kpis: {
        Row: {
          admin_note: string | null
          category: string | null
          confidence: string | null
          country_code: string
          created_at: string
          direction: string
          freshness_status: string
          id: string
          inference_evidence: Json | null
          inference_history: Json
          inference_model: string | null
          inference_rationale: string | null
          inferred_at: string | null
          kpi_code: string
          label: string
          last_verified_at: string | null
          latest_period: string | null
          latest_value: number | null
          notes: string | null
          owner_country_code: string | null
          provenance: string
          research_notes: string | null
          source_id: string | null
          source_url: string | null
          target: number | null
          unit: string
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
          visibility: string
        }
        Insert: {
          admin_note?: string | null
          category?: string | null
          confidence?: string | null
          country_code: string
          created_at?: string
          direction?: string
          freshness_status?: string
          id?: string
          inference_evidence?: Json | null
          inference_history?: Json
          inference_model?: string | null
          inference_rationale?: string | null
          inferred_at?: string | null
          kpi_code: string
          label: string
          last_verified_at?: string | null
          latest_period?: string | null
          latest_value?: number | null
          notes?: string | null
          owner_country_code?: string | null
          provenance?: string
          research_notes?: string | null
          source_id?: string | null
          source_url?: string | null
          target?: number | null
          unit: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          visibility?: string
        }
        Update: {
          admin_note?: string | null
          category?: string | null
          confidence?: string | null
          country_code?: string
          created_at?: string
          direction?: string
          freshness_status?: string
          id?: string
          inference_evidence?: Json | null
          inference_history?: Json
          inference_model?: string | null
          inference_rationale?: string | null
          inferred_at?: string | null
          kpi_code?: string
          label?: string
          last_verified_at?: string | null
          latest_period?: string | null
          latest_value?: number | null
          notes?: string | null
          owner_country_code?: string | null
          provenance?: string
          research_notes?: string | null
          source_id?: string | null
          source_url?: string | null
          target?: number | null
          unit?: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_kpis_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "country_kpis_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "country_sources"
            referencedColumns: ["id"]
          },
        ]
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
      country_source_chunks: {
        Row: {
          chunk_index: number
          content: string
          country_code: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          owner_country_code: string | null
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          chunk_index: number
          content: string
          country_code: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          owner_country_code?: string | null
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          country_code?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          owner_country_code?: string | null
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_source_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "country_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      country_source_connections: {
        Row: {
          auth_header_name: string | null
          config: Json
          country_source_id: string
          created_at: string
          endpoint_url: string
          id: string
          kind: string
          last_error: string | null
          last_polled_at: string | null
          last_status: string | null
          secret_ref: string | null
          updated_at: string
        }
        Insert: {
          auth_header_name?: string | null
          config?: Json
          country_source_id: string
          created_at?: string
          endpoint_url: string
          id?: string
          kind: string
          last_error?: string | null
          last_polled_at?: string | null
          last_status?: string | null
          secret_ref?: string | null
          updated_at?: string
        }
        Update: {
          auth_header_name?: string | null
          config?: Json
          country_source_id?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_polled_at?: string | null
          last_status?: string | null
          secret_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_source_connections_country_source_id_fkey"
            columns: ["country_source_id"]
            isOneToOne: true
            referencedRelation: "country_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      country_source_documents: {
        Row: {
          char_count: number
          chunk_count: number
          content_hash: string | null
          country_source_id: string
          created_at: string
          fetched_at: string
          id: string
          owner_country_code: string | null
          raw_text: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          char_count: number
          chunk_count?: number
          content_hash?: string | null
          country_source_id: string
          created_at?: string
          fetched_at?: string
          id?: string
          owner_country_code?: string | null
          raw_text: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          char_count?: number
          chunk_count?: number
          content_hash?: string | null
          country_source_id?: string
          created_at?: string
          fetched_at?: string
          id?: string
          owner_country_code?: string | null
          raw_text?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_source_documents_country_source_id_fkey"
            columns: ["country_source_id"]
            isOneToOne: false
            referencedRelation: "country_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      country_sources: {
        Row: {
          active: boolean
          connection_kind: string | null
          country_code: string
          created_at: string
          created_by: string | null
          fetch_error: string | null
          fetch_status: string | null
          id: string
          kind: string
          last_fetched_at: string | null
          org: string
          owner_country_code: string | null
          quality_score: number
          storage_path: string | null
          summary: string | null
          summary_generated_at: string | null
          tags: string[]
          title: string
          tld: string | null
          updated_at: string
          uploaded_by: string | null
          url: string
          visibility: string
        }
        Insert: {
          active?: boolean
          connection_kind?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          fetch_error?: string | null
          fetch_status?: string | null
          id?: string
          kind: string
          last_fetched_at?: string | null
          org: string
          owner_country_code?: string | null
          quality_score?: number
          storage_path?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          tags?: string[]
          title: string
          tld?: string | null
          updated_at?: string
          uploaded_by?: string | null
          url: string
          visibility?: string
        }
        Update: {
          active?: boolean
          connection_kind?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          fetch_error?: string | null
          fetch_status?: string | null
          id?: string
          kind?: string
          last_fetched_at?: string | null
          org?: string
          owner_country_code?: string | null
          quality_score?: number
          storage_path?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          tags?: string[]
          title?: string
          tld?: string | null
          updated_at?: string
          uploaded_by?: string | null
          url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_sources_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      curation_batches: {
        Row: {
          committed_at: string
          curator_id: string | null
          id: string
          item_count: number
          scope_key: string
          weight_distribution: Json
        }
        Insert: {
          committed_at?: string
          curator_id?: string | null
          id?: string
          item_count?: number
          scope_key: string
          weight_distribution?: Json
        }
        Update: {
          committed_at?: string
          curator_id?: string | null
          id?: string
          item_count?: number
          scope_key?: string
          weight_distribution?: Json
        }
        Relationships: []
      }
      data_revisions: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_value: number | null
          period: string | null
          previous_value: number | null
          reason: string | null
          series_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: number | null
          period?: string | null
          previous_value?: number | null
          reason?: string | null
          series_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: number | null
          period?: string | null
          previous_value?: number | null
          reason?: string | null
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_revisions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_revisions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_freshness"
            referencedColumns: ["series_id"]
          },
        ]
      }
      decisions: {
        Row: {
          agenda_item_id: string | null
          body: string | null
          classification: string
          country_code: string
          duration_sec: number | null
          id: string
          mandate_id: string | null
          motion_kind: string | null
          recorded_at: string
          recorded_by: string | null
          session_id: string
          title: string
        }
        Insert: {
          agenda_item_id?: string | null
          body?: string | null
          classification?: string
          country_code: string
          duration_sec?: number | null
          id?: string
          mandate_id?: string | null
          motion_kind?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          title: string
        }
        Update: {
          agenda_item_id?: string | null
          body?: string | null
          classification?: string
          country_code?: string
          duration_sec?: number | null
          id?: string
          mandate_id?: string | null
          motion_kind?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "cabinet_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cabinet_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_questions: {
        Row: {
          answer_ref: string | null
          created_at: string
          created_by: string | null
          id: string
          question: string
          scope_key: string
          sector_code: string | null
          signal_id: string
          status: string
          updated_at: string
        }
        Insert: {
          answer_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          question: string
          scope_key: string
          sector_code?: string | null
          signal_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          answer_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          question?: string
          scope_key?: string
          sector_code?: string | null
          signal_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_questions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      exports_documents: {
        Row: {
          html: string
          id: string
          kind: string
          metadata: Json
          rendered_at: string
          rendered_by: string | null
          scope_key: string | null
          source_id: string | null
          title: string
        }
        Insert: {
          html: string
          id?: string
          kind: string
          metadata?: Json
          rendered_at?: string
          rendered_by?: string | null
          scope_key?: string | null
          source_id?: string | null
          title: string
        }
        Update: {
          html?: string
          id?: string
          kind?: string
          metadata?: Json
          rendered_at?: string
          rendered_by?: string | null
          scope_key?: string | null
          source_id?: string | null
          title?: string
        }
        Relationships: []
      }
      exports_log: {
        Row: {
          artifact_kind: string
          artifact_ref: string | null
          classification: string
          country_code: string
          exported_at: string
          exported_by: string | null
          id: string
          watermark: string
        }
        Insert: {
          artifact_kind: string
          artifact_ref?: string | null
          classification?: string
          country_code: string
          exported_at?: string
          exported_by?: string | null
          id?: string
          watermark: string
        }
        Update: {
          artifact_kind?: string
          artifact_ref?: string | null
          classification?: string
          country_code?: string
          exported_at?: string
          exported_by?: string | null
          id?: string
          watermark?: string
        }
        Relationships: []
      }
      exposure_index: {
        Row: {
          confidence_grade: string
          country_code: string
          created_at: string
          decomposition: Json
          id: string
          methodology_ref: string | null
          period: string
          value: number
        }
        Insert: {
          confidence_grade?: string
          country_code: string
          created_at?: string
          decomposition?: Json
          id?: string
          methodology_ref?: string | null
          period: string
          value: number
        }
        Update: {
          confidence_grade?: string
          country_code?: string
          created_at?: string
          decomposition?: Json
          id?: string
          methodology_ref?: string | null
          period?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "exposure_index_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      fdi_strategies: {
        Row: {
          actions: Json
          allocation: Json
          country_code: string
          created_at: string
          created_by: string | null
          fdi_threat_id: string
          id: string
          metrics: Json
          name: string
          owner_country_code: string | null
          promoted_at: string | null
          promoted_scenario_id: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          actions?: Json
          allocation?: Json
          country_code: string
          created_at?: string
          created_by?: string | null
          fdi_threat_id: string
          id?: string
          metrics?: Json
          name: string
          owner_country_code?: string | null
          promoted_at?: string | null
          promoted_scenario_id?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          actions?: Json
          allocation?: Json
          country_code?: string
          created_at?: string
          created_by?: string | null
          fdi_threat_id?: string
          id?: string
          metrics?: Json
          name?: string
          owner_country_code?: string | null
          promoted_at?: string | null
          promoted_scenario_id?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "fdi_strategies_fdi_threat_id_fkey"
            columns: ["fdi_threat_id"]
            isOneToOne: false
            referencedRelation: "fdi_threats"
            referencedColumns: ["id"]
          },
        ]
      }
      fdi_threats: {
        Row: {
          brief: Json
          country_code: string
          created_at: string
          created_by: string | null
          horizon_years: number
          id: string
          name: string
          onset: string
          owner_country_code: string | null
          severity_pct: number
          target_sector_codes: string[]
          threat_type: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          brief?: Json
          country_code: string
          created_at?: string
          created_by?: string | null
          horizon_years?: number
          id?: string
          name: string
          onset?: string
          owner_country_code?: string | null
          severity_pct?: number
          target_sector_codes?: string[]
          threat_type: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          brief?: Json
          country_code?: string
          created_at?: string
          created_by?: string | null
          horizon_years?: number
          id?: string
          name?: string
          onset?: string
          owner_country_code?: string | null
          severity_pct?: number
          target_sector_codes?: string[]
          threat_type?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      figure_snapshots: {
        Row: {
          ai_explanation: string | null
          citations: Json
          confidence_grade: string | null
          country_code: string
          created_at: string
          created_by: string
          figure_kind: string
          figure_ref: Json
          id: string
          label: string
          note: string | null
          scope: string
          scope_ref: string | null
          source_snapshot: Json
          unit: string | null
          value: number | null
        }
        Insert: {
          ai_explanation?: string | null
          citations?: Json
          confidence_grade?: string | null
          country_code: string
          created_at?: string
          created_by: string
          figure_kind: string
          figure_ref: Json
          id?: string
          label: string
          note?: string | null
          scope?: string
          scope_ref?: string | null
          source_snapshot?: Json
          unit?: string | null
          value?: number | null
        }
        Update: {
          ai_explanation?: string | null
          citations?: Json
          confidence_grade?: string | null
          country_code?: string
          created_at?: string
          created_by?: string
          figure_kind?: string
          figure_ref?: Json
          id?: string
          label?: string
          note?: string | null
          scope?: string
          scope_ref?: string | null
          source_snapshot?: Json
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "figure_snapshots_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
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
      goal_cycles: {
        Row: {
          commentary: string | null
          created_at: string
          created_by: string | null
          figures: Json
          id: string
          kpi_id: string
          period: string
          snapshot_at: string
          status: string
          updated_at: string
        }
        Insert: {
          commentary?: string | null
          created_at?: string
          created_by?: string | null
          figures?: Json
          id?: string
          kpi_id: string
          period: string
          snapshot_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          commentary?: string | null
          created_at?: string
          created_by?: string | null
          figures?: Json
          id?: string
          kpi_id?: string
          period?: string
          snapshot_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_cycles_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          country_code: string
          created_at: string
          id: string
          new_grade: string
          previous_grade: string | null
          reason: string | null
          sector_code: string | null
          series_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          country_code: string
          created_at?: string
          id?: string
          new_grade: string
          previous_grade?: string | null
          reason?: string | null
          sector_code?: string | null
          series_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          country_code?: string
          created_at?: string
          id?: string
          new_grade?: string
          previous_grade?: string | null
          reason?: string | null
          sector_code?: string | null
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_alerts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_alerts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_freshness"
            referencedColumns: ["series_id"]
          },
        ]
      }
      harvest_runs: {
        Row: {
          cadence_slot: string
          counts: Json
          failures: Json
          finished_at: string | null
          id: string
          scope_key: string
          started_at: string
        }
        Insert: {
          cadence_slot: string
          counts?: Json
          failures?: Json
          finished_at?: string | null
          id?: string
          scope_key: string
          started_at?: string
        }
        Update: {
          cadence_slot?: string
          counts?: Json
          failures?: Json
          finished_at?: string | null
          id?: string
          scope_key?: string
          started_at?: string
        }
        Relationships: []
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
      instance_bindings: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_bindings_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      instance_config: {
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
      intake_items: {
        Row: {
          created_at: string
          duplicate_of: string | null
          final_weight: number | null
          harvest_run_id: string | null
          id: string
          metadata: Json
          proposed_weight: number
          reach: number | null
          recommendation: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string | null
          scope_key: string
          sector_code: string
          sentiment: number | null
          severity: number | null
          source_id: string | null
          state: string
          story_key: string | null
          story_primary: boolean
          summary: string | null
          topic: string
          url: string | null
        }
        Insert: {
          created_at?: string
          duplicate_of?: string | null
          final_weight?: number | null
          harvest_run_id?: string | null
          id?: string
          metadata?: Json
          proposed_weight?: number
          reach?: number | null
          recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string | null
          scope_key: string
          sector_code: string
          sentiment?: number | null
          severity?: number | null
          source_id?: string | null
          state?: string
          story_key?: string | null
          story_primary?: boolean
          summary?: string | null
          topic: string
          url?: string | null
        }
        Update: {
          created_at?: string
          duplicate_of?: string | null
          final_weight?: number | null
          harvest_run_id?: string | null
          id?: string
          metadata?: Json
          proposed_weight?: number
          reach?: number | null
          recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string | null
          scope_key?: string
          sector_code?: string
          sentiment?: number | null
          severity?: number | null
          source_id?: string | null
          state?: string
          story_key?: string | null
          story_primary?: boolean
          summary?: string | null
          topic?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_harvest_run_id_fkey"
            columns: ["harvest_run_id"]
            isOneToOne: false
            referencedRelation: "harvest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
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
      keying_audits: {
        Row: {
          id: string
          ran_at: string
          ran_by: string | null
          report: Json
          total_checked: number
          total_violations: number
        }
        Insert: {
          id?: string
          ran_at?: string
          ran_by?: string | null
          report?: Json
          total_checked?: number
          total_violations?: number
        }
        Update: {
          id?: string
          ran_at?: string
          ran_by?: string | null
          report?: Json
          total_checked?: number
          total_violations?: number
        }
        Relationships: []
      }
      kpi_research_attempts: {
        Row: {
          country_code: string
          created_at: string
          error: string | null
          id: string
          kpi_code: string
          model: string | null
          ok: boolean
          pass: string
          period: string | null
          provider: string
          run_id: string | null
          source_url: string | null
          value: number | null
        }
        Insert: {
          country_code: string
          created_at?: string
          error?: string | null
          id?: string
          kpi_code: string
          model?: string | null
          ok?: boolean
          pass: string
          period?: string | null
          provider: string
          run_id?: string | null
          source_url?: string | null
          value?: number | null
        }
        Update: {
          country_code?: string
          created_at?: string
          error?: string | null
          id?: string
          kpi_code?: string
          model?: string | null
          ok?: boolean
          pass?: string
          period?: string | null
          provider?: string
          run_id?: string | null
          source_url?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_research_attempts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "onboarding_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_seed_items: {
        Row: {
          attempt_count: number
          country_code: string
          created_at: string
          diagnostics: Json
          id: string
          inference: Json | null
          kpi_code: string
          label: string
          last_error: string | null
          notes: string | null
          pass: string
          period: string | null
          run_id: string
          source_org: string | null
          source_url: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          attempt_count?: number
          country_code: string
          created_at?: string
          diagnostics?: Json
          id?: string
          inference?: Json | null
          kpi_code: string
          label: string
          last_error?: string | null
          notes?: string | null
          pass?: string
          period?: string | null
          run_id: string
          source_org?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          attempt_count?: number
          country_code?: string
          created_at?: string
          diagnostics?: Json
          id?: string
          inference?: Json | null
          kpi_code?: string
          label?: string
          last_error?: string | null
          notes?: string | null
          pass?: string
          period?: string | null
          run_id?: string
          source_org?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          captured_at: string
          created_by: string | null
          id: string
          kpi_id: string
          metadata: Json
          period_label: string
          target: number | null
          value: number | null
          variance_pct: number | null
          window_kind: string
        }
        Insert: {
          captured_at?: string
          created_by?: string | null
          id?: string
          kpi_id: string
          metadata?: Json
          period_label: string
          target?: number | null
          value?: number | null
          variance_pct?: number | null
          window_kind: string
        }
        Update: {
          captured_at?: string
          created_by?: string | null
          id?: string
          kpi_id?: string
          metadata?: Json
          period_label?: string
          target?: number | null
          value?: number | null
          variance_pct?: number | null
          window_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          baseline: number | null
          cadence: string
          classification: string
          country_code: string
          created_at: string
          id: string
          metric: string
          ministry_id: string | null
          owner_id: string | null
          plan_scenario_id: string | null
          sector_code: string
          target: number
          target_period: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          baseline?: number | null
          cadence?: string
          classification?: string
          country_code: string
          created_at?: string
          id?: string
          metric: string
          ministry_id?: string | null
          owner_id?: string | null
          plan_scenario_id?: string | null
          sector_code: string
          target: number
          target_period?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          baseline?: number | null
          cadence?: string
          classification?: string
          country_code?: string
          created_at?: string
          id?: string
          metric?: string
          ministry_id?: string | null
          owner_id?: string | null
          plan_scenario_id?: string | null
          sector_code?: string
          target?: number
          target_period?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_plan_scenario_id_fkey"
            columns: ["plan_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_qa_actions: {
        Row: {
          action: string
          actor: string | null
          check_key: string
          country_code: string
          created_at: string
          detail: Json
          finding_class: string
          id: string
          rows_after: number | null
          rows_before: number | null
        }
        Insert: {
          action: string
          actor?: string | null
          check_key: string
          country_code: string
          created_at?: string
          detail?: Json
          finding_class: string
          id?: string
          rows_after?: number | null
          rows_before?: number | null
        }
        Update: {
          action?: string
          actor?: string | null
          check_key?: string
          country_code?: string
          created_at?: string
          detail?: Json
          finding_class?: string
          id?: string
          rows_after?: number | null
          rows_before?: number | null
        }
        Relationships: []
      }
      lever_drafts: {
        Row: {
          citations: Json
          committed_at: string | null
          country_code: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          citations?: Json
          committed_at?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          citations?: Json
          committed_at?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      levers: {
        Row: {
          bounds: Json
          citations: Json
          country_code: string
          created_at: string
          draft_id: string | null
          id: string
          methodology_ref: string | null
          name: string
          rationale: string | null
          response_fn_ref: string
          sector_code: string
          slug: string
          unit: string
          updated_at: string
        }
        Insert: {
          bounds?: Json
          citations?: Json
          country_code: string
          created_at?: string
          draft_id?: string | null
          id?: string
          methodology_ref?: string | null
          name: string
          rationale?: string | null
          response_fn_ref?: string
          sector_code: string
          slug: string
          unit: string
          updated_at?: string
        }
        Update: {
          bounds?: Json
          citations?: Json
          country_code?: string
          created_at?: string
          draft_id?: string | null
          id?: string
          methodology_ref?: string | null
          name?: string
          rationale?: string | null
          response_fn_ref?: string
          sector_code?: string
          slug?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "levers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "levers_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "lever_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levers_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
      mandates: {
        Row: {
          cadence: string
          country_code: string
          created_at: string
          id: string
          kpi_id: string | null
          package_id: string | null
          scenario_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          country_code: string
          created_at?: string
          id?: string
          kpi_id?: string | null
          package_id?: string | null
          scenario_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          country_code?: string
          created_at?: string
          id?: string
          kpi_id?: string | null
          package_id?: string | null
          scenario_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandates_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
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
      memory_objects: {
        Row: {
          created_at: string
          created_by: string | null
          embedding: string | null
          id: string
          kind: string
          owner_country_code: string | null
          payload: Json
          scope_key: string
          sector_code: string
          source_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          verified: boolean
          visibility: string
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          kind: string
          owner_country_code?: string | null
          payload?: Json
          scope_key: string
          sector_code: string
          source_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          verified?: boolean
          visibility?: string
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          kind?: string
          owner_country_code?: string | null
          payload?: Json
          scope_key?: string
          sector_code?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          verified?: boolean
          visibility?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "memory_objects_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      minister_backfill_country_runs: {
        Row: {
          attempted: number
          country_code: string
          created_at: string
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          ministries: Json
          resolved: number
          run_id: string
          skipped: number
          started_at: string | null
          status: string
          updated: number
        }
        Insert: {
          attempted?: number
          country_code: string
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          ministries?: Json
          resolved?: number
          run_id: string
          skipped?: number
          started_at?: string | null
          status?: string
          updated?: number
        }
        Update: {
          attempted?: number
          country_code?: string
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          ministries?: Json
          resolved?: number
          run_id?: string
          skipped?: number
          started_at?: string | null
          status?: string
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "minister_backfill_country_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "minister_backfill_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      minister_backfill_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          params: Json
          requested_by: string | null
          started_at: string | null
          status: string
          totals: Json
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          params?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
          totals?: Json
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          params?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
          totals?: Json
        }
        Relationships: []
      }
      ministries: {
        Row: {
          country_code: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      ministry_deep_dive_items: {
        Row: {
          citations: Json
          confidence: string | null
          country_code: string
          created_at: string
          diagnostics: Json
          error: string | null
          id: string
          mandate: string | null
          minister: string | null
          minister_profile: Json
          ministry_name: string
          ministry_slug: string
          programmes: Json
          run_id: string
          source_tier: string | null
          status: string
          updated_at: string
        }
        Insert: {
          citations?: Json
          confidence?: string | null
          country_code: string
          created_at?: string
          diagnostics?: Json
          error?: string | null
          id?: string
          mandate?: string | null
          minister?: string | null
          minister_profile?: Json
          ministry_name: string
          ministry_slug: string
          programmes?: Json
          run_id: string
          source_tier?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          citations?: Json
          confidence?: string | null
          country_code?: string
          created_at?: string
          diagnostics?: Json
          error?: string | null
          id?: string
          mandate?: string | null
          minister?: string | null
          minister_profile?: Json
          ministry_name?: string
          ministry_slug?: string
          programmes?: Json
          run_id?: string
          source_tier?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ministry_profiles: {
        Row: {
          citations: Json
          country_code: string
          created_at: string
          id: string
          mandate: string | null
          minister: string | null
          minister_profile: Json
          ministry_slug: string
          owner_country_code: string | null
          programmes: Json
          source_ids: string[]
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          citations?: Json
          country_code: string
          created_at?: string
          id?: string
          mandate?: string | null
          minister?: string | null
          minister_profile?: Json
          ministry_slug: string
          owner_country_code?: string | null
          programmes?: Json
          source_ids?: string[]
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          citations?: Json
          country_code?: string
          created_at?: string
          id?: string
          mandate?: string | null
          minister?: string | null
          minister_profile?: Json
          ministry_slug?: string
          owner_country_code?: string | null
          programmes?: Json
          source_ids?: string[]
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      ministry_sectors: {
        Row: {
          created_at: string
          ministry_id: string
          sector_code: string
          weight: number
        }
        Insert: {
          created_at?: string
          ministry_id: string
          sector_code: string
          weight?: number
        }
        Update: {
          created_at?: string
          ministry_id?: string
          sector_code?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ministry_sectors_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_sectors_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
      narrative_entity_watchlist: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          created_by: string | null
          entity_name: string
          entity_role: string | null
          id: string
          last_feed_built_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code: string
          created_at?: string
          created_by?: string | null
          entity_name: string
          entity_role?: string | null
          id?: string
          last_feed_built_at?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          created_by?: string | null
          entity_name?: string
          entity_role?: string | null
          id?: string
          last_feed_built_at?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      narrative_feed_items: {
        Row: {
          country_code: string
          error: string | null
          feed_id: string
          fetched_at: string
          guid_hash: string
          id: string
          published_at: string | null
          raw_excerpt: string | null
          signal_id: string | null
          state: string
          title: string | null
          url: string | null
        }
        Insert: {
          country_code: string
          error?: string | null
          feed_id: string
          fetched_at?: string
          guid_hash: string
          id?: string
          published_at?: string | null
          raw_excerpt?: string | null
          signal_id?: string | null
          state?: string
          title?: string | null
          url?: string | null
        }
        Update: {
          country_code?: string
          error?: string | null
          feed_id?: string
          fetched_at?: string
          guid_hash?: string
          id?: string
          published_at?: string | null
          raw_excerpt?: string | null
          signal_id?: string | null
          state?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_feed_items_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "narrative_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_feed_items_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_feeds: {
        Row: {
          active: boolean
          consecutive_failures: number
          country_code: string
          created_at: string
          discovered_at: string | null
          endpoint: string
          etag: string | null
          id: string
          is_query: boolean
          is_seed: boolean
          kind: string
          label: string | null
          language: string | null
          last_error: string | null
          last_hash: string | null
          last_polled_at: string | null
          last_revive_at: string | null
          last_status: string | null
          ministry_hint: string | null
          owner_country_code: string | null
          query_template: string | null
          scope: string
          sector_hint: string | null
          tier_hint: string | null
          updated_at: string
          uploaded_by: string | null
          visibility: string
          weight: number
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          country_code: string
          created_at?: string
          discovered_at?: string | null
          endpoint: string
          etag?: string | null
          id?: string
          is_query?: boolean
          is_seed?: boolean
          kind: string
          label?: string | null
          language?: string | null
          last_error?: string | null
          last_hash?: string | null
          last_polled_at?: string | null
          last_revive_at?: string | null
          last_status?: string | null
          ministry_hint?: string | null
          owner_country_code?: string | null
          query_template?: string | null
          scope: string
          sector_hint?: string | null
          tier_hint?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
          weight?: number
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          country_code?: string
          created_at?: string
          discovered_at?: string | null
          endpoint?: string
          etag?: string | null
          id?: string
          is_query?: boolean
          is_seed?: boolean
          kind?: string
          label?: string | null
          language?: string | null
          last_error?: string | null
          last_hash?: string | null
          last_polled_at?: string | null
          last_revive_at?: string | null
          last_status?: string | null
          ministry_hint?: string | null
          owner_country_code?: string | null
          query_template?: string | null
          scope?: string
          sector_hint?: string | null
          tier_hint?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
          weight?: number
        }
        Relationships: []
      }
      narrative_harvest_runs: {
        Row: {
          countries_run: string[]
          coverage: Json
          errors: Json
          feeds_polled: number
          finished_at: string | null
          id: string
          items_fetched: number
          items_new: number
          items_promoted: number
          started_at: string
          triggered_by: string
          window_key: string | null
        }
        Insert: {
          countries_run?: string[]
          coverage?: Json
          errors?: Json
          feeds_polled?: number
          finished_at?: string | null
          id?: string
          items_fetched?: number
          items_new?: number
          items_promoted?: number
          started_at?: string
          triggered_by?: string
          window_key?: string | null
        }
        Update: {
          countries_run?: string[]
          coverage?: Json
          errors?: Json
          feeds_polled?: number
          finished_at?: string | null
          id?: string
          items_fetched?: number
          items_new?: number
          items_promoted?: number
          started_at?: string
          triggered_by?: string
          window_key?: string | null
        }
        Relationships: []
      }
      narrative_lineage: {
        Row: {
          artifact_id: string
          artifact_type: string
          created_at: string
          created_by: string | null
          id: string
          scope_key: string
          sector_code: string | null
          signal_id: string | null
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          scope_key: string
          sector_code?: string | null
          signal_id?: string | null
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          scope_key?: string
          sector_code?: string | null
          signal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_lineage_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_citations: {
        Row: {
          created_at: string
          domain: string | null
          domain_tier: string | null
          draft_id: string
          id: string
          owner_country_code: string | null
          promoted_domain: boolean
          published_at: string | null
          quote: string | null
          title: string | null
          uploaded_by: string | null
          url: string
          visibility: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          domain_tier?: string | null
          draft_id: string
          id?: string
          owner_country_code?: string | null
          promoted_domain?: boolean
          published_at?: string | null
          quote?: string | null
          title?: string | null
          uploaded_by?: string | null
          url: string
          visibility?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          domain_tier?: string | null
          draft_id?: string
          id?: string
          owner_country_code?: string | null
          promoted_domain?: boolean
          published_at?: string | null
          quote?: string | null
          title?: string | null
          uploaded_by?: string | null
          url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_citations_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "onboarding_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_drafts: {
        Row: {
          committed_at: string | null
          confidence: string
          country_code: string
          created_at: string
          edited_payload: Json | null
          id: string
          needs_review: boolean
          payload: Json
          run_id: string
          stage: string
          summary_highlights: Json
          summary_md: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          committed_at?: string | null
          confidence?: string
          country_code: string
          created_at?: string
          edited_payload?: Json | null
          id?: string
          needs_review?: boolean
          payload: Json
          run_id: string
          stage: string
          summary_highlights?: Json
          summary_md?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          committed_at?: string | null
          confidence?: string
          country_code?: string
          created_at?: string
          edited_payload?: Json | null
          id?: string
          needs_review?: boolean
          payload?: Json
          run_id?: string
          stage?: string
          summary_highlights?: Json
          summary_md?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "onboarding_drafts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "onboarding_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_pipeline_runs: {
        Row: {
          country_code: string
          current_stage: string | null
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          plan: Json
          results: Json
          started_at: string
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          country_code: string
          current_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          plan?: Json
          results?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          current_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          plan?: Json
          results?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_pipeline_runs_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      onboarding_runs: {
        Row: {
          cost_cents: number
          country_code: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          model_stack: Json
          plan: Json | null
          stage: string
          started_at: string
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          country_code: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          model_stack?: Json
          plan?: Json | null
          stage: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          country_code?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          model_stack?: Json
          plan?: Json | null
          stage?: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_runs_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      onboarding_summaries: {
        Row: {
          country_code: string
          generated_at: string
          highlights: Json
          model: string | null
          source_run_id: string | null
          stage: string
          summary_md: string
          updated_at: string
        }
        Insert: {
          country_code: string
          generated_at?: string
          highlights?: Json
          model?: string | null
          source_run_id?: string | null
          stage: string
          summary_md?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          generated_at?: string
          highlights?: Json
          model?: string | null
          source_run_id?: string | null
          stage?: string
          summary_md?: string
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          enabling_actions: Json
          gates: Json
          id: string
          name: string
          sector_code: string
          status: string
          summary: string | null
          target_gap_pct: number | null
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by?: string | null
          enabling_actions?: Json
          gates?: Json
          id?: string
          name: string
          sector_code: string
          status?: string
          summary?: string | null
          target_gap_pct?: number | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          enabling_actions?: Json
          gates?: Json
          id?: string
          name?: string
          sector_code?: string
          status?: string
          summary?: string | null
          target_gap_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      persona_chat_messages: {
        Row: {
          chat_id: string
          citations: Json
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          citations?: Json
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          citations?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "persona_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_chats: {
        Row: {
          country_code: string
          created_at: string
          id: string
          persona_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          persona_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          persona_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_chats_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_segment_members: {
        Row: {
          persona_id: string
          segment_id: string
        }
        Insert: {
          persona_id: string
          segment_id: string
        }
        Update: {
          persona_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_segment_members_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "persona_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_segments: {
        Row: {
          country_code: string
          created_at: string
          distribution: Json
          id: string
          label: string
          owner_country_code: string | null
          owner_user_id: string | null
          prompt: string
          size: number
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          country_code: string
          created_at?: string
          distribution?: Json
          id?: string
          label: string
          owner_country_code?: string | null
          owner_user_id?: string | null
          prompt: string
          size?: number
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          distribution?: Json
          id?: string
          label?: string
          owner_country_code?: string | null
          owner_user_id?: string | null
          prompt?: string
          size?: number
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          archetype: string | null
          attributes: Json
          citations: Json
          country_code: string
          created_at: string
          grounding_refs: Json
          id: string
          name: string
          ocean: Json
          origin: string
          owner_country_code: string | null
          owner_user_id: string | null
          summary: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
          visibility: string
        }
        Insert: {
          archetype?: string | null
          attributes?: Json
          citations?: Json
          country_code: string
          created_at?: string
          grounding_refs?: Json
          id?: string
          name: string
          ocean?: Json
          origin?: string
          owner_country_code?: string | null
          owner_user_id?: string | null
          summary?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          archetype?: string | null
          attributes?: Json
          citations?: Json
          country_code?: string
          created_at?: string
          grounding_refs?: Json
          id?: string
          name?: string
          ocean?: Json
          origin?: string
          owner_country_code?: string | null
          owner_user_id?: string | null
          summary?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_country_code: string | null
          display_name: string | null
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_country_code?: string | null
          display_name?: string | null
          id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_country_code?: string | null
          display_name?: string | null
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_country_code_fkey"
            columns: ["default_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      reconciliation_notes: {
        Row: {
          country_code: string
          created_at: string
          created_by: string
          id: string
          note: string
          residual_pct: number | null
          resolved_at: string | null
          resolved_by: string | null
          subject_key: string
          subject_kind: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by: string
          id?: string
          note: string
          residual_pct?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          subject_key: string
          subject_kind: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          residual_pct?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          subject_key?: string
          subject_kind?: string
        }
        Relationships: []
      }
      research_briefs: {
        Row: {
          created_at: string
          id: string
          prompt: string
          recency: string | null
          requested_by: string | null
          results: Json
          scope_key: string
          sector_hint: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          recency?: string | null
          requested_by?: string | null
          results?: Json
          scope_key: string
          sector_hint?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          recency?: string | null
          requested_by?: string | null
          results?: Json
          scope_key?: string
          sector_hint?: string | null
        }
        Relationships: []
      }
      scenario_promotions: {
        Row: {
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["scenario_status"]
          id: string
          note: string | null
          scenario_id: string
          to_status: Database["public"]["Enums"]["scenario_status"]
        }
        Insert: {
          actor_id: string
          created_at?: string
          from_status: Database["public"]["Enums"]["scenario_status"]
          id?: string
          note?: string | null
          scenario_id: string
          to_status: Database["public"]["Enums"]["scenario_status"]
        }
        Update: {
          actor_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["scenario_status"]
          id?: string
          note?: string | null
          scenario_id?: string
          to_status?: Database["public"]["Enums"]["scenario_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scenario_promotions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          assumptions: Json
          attribution: Json
          author_id: string
          country_code: string
          created_at: string
          horizon_years: number
          id: string
          lever_settings: Json
          ministry_id: string | null
          model_version: string
          results: Json
          sector_code: string | null
          status: Database["public"]["Enums"]["scenario_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          attribution?: Json
          author_id: string
          country_code: string
          created_at?: string
          horizon_years?: number
          id?: string
          lever_settings?: Json
          ministry_id?: string | null
          model_version?: string
          results?: Json
          sector_code?: string | null
          status?: Database["public"]["Enums"]["scenario_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          attribution?: Json
          author_id?: string
          country_code?: string
          created_at?: string
          horizon_years?: number
          id?: string
          lever_settings?: Json
          ministry_id?: string | null
          model_version?: string
          results?: Json
          sector_code?: string | null
          status?: Database["public"]["Enums"]["scenario_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "scenarios_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
      sector_dossier_briefs: {
        Row: {
          brief: Json
          citations: Json
          context_hash: string | null
          country_code: string
          generated_at: string
          input_fingerprint: string | null
          schema_version: number
          sector_code: string
          updated_at: string
        }
        Insert: {
          brief: Json
          citations?: Json
          context_hash?: string | null
          country_code: string
          generated_at?: string
          input_fingerprint?: string | null
          schema_version?: number
          sector_code: string
          updated_at?: string
        }
        Update: {
          brief?: Json
          citations?: Json
          context_hash?: string | null
          country_code?: string
          generated_at?: string
          input_fingerprint?: string | null
          schema_version?: number
          sector_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      sector_dossiers: {
        Row: {
          citations: Json
          confidence: string
          country_code: string
          created_at: string
          id: string
          kind: string
          owner_country_code: string | null
          payload: Json
          sector_code: string
          source_ids: string[]
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          citations?: Json
          confidence?: string
          country_code: string
          created_at?: string
          id?: string
          kind: string
          owner_country_code?: string | null
          payload: Json
          sector_code: string
          source_ids?: string[]
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          citations?: Json
          confidence?: string
          country_code?: string
          created_at?: string
          id?: string
          kind?: string
          owner_country_code?: string | null
          payload?: Json
          sector_code?: string
          source_ids?: string[]
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_dossiers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      sector_edges: {
        Row: {
          from_sector: string
          id: string
          notes: string | null
          order_rank: number
          to_sector: string
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          from_sector: string
          id?: string
          notes?: string | null
          order_rank?: number
          to_sector: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          from_sector?: string
          id?: string
          notes?: string | null
          order_rank?: number
          to_sector?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
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
      series: {
        Row: {
          confidence_grade: string
          country_code: string
          created_at: string
          frequency: string
          id: string
          methodology_ref: string | null
          metric: string
          sector_code: string
          source_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          confidence_grade?: string
          country_code: string
          created_at?: string
          frequency: string
          id?: string
          methodology_ref?: string | null
          metric: string
          sector_code: string
          source_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          confidence_grade?: string
          country_code?: string
          created_at?: string
          frequency?: string
          id?: string
          methodology_ref?: string | null
          metric?: string
          sector_code?: string
          source_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "series_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "series_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      series_points: {
        Row: {
          created_at: string
          id: string
          period: string
          revised_at: string | null
          revised_from: number | null
          series_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          period: string
          revised_at?: string | null
          revised_from?: number | null
          series_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          period?: string
          revised_at?: string | null
          revised_from?: number | null
          series_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "series_points_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_points_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_freshness"
            referencedColumns: ["series_id"]
          },
        ]
      }
      source_candidates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          country_code: string
          created_at: string
          id: string
          rationale: string | null
          status: string
          suggested_by_model: string | null
          suggested_for_kpi: string | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          country_code: string
          created_at?: string
          id?: string
          rationale?: string | null
          status?: string
          suggested_by_model?: string | null
          suggested_for_kpi?: string | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          country_code?: string
          created_at?: string
          id?: string
          rationale?: string | null
          status?: string
          suggested_by_model?: string | null
          suggested_for_kpi?: string | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_candidates_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      source_health_checks: {
        Row: {
          checked_at: string
          country_code: string
          error: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          ok: boolean
          source_id: string
        }
        Insert: {
          checked_at?: string
          country_code: string
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          source_id: string
        }
        Update: {
          checked_at?: string
          country_code?: string
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_health_checks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "country_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_suppressions: {
        Row: {
          active: boolean
          actor_id: string | null
          created_at: string
          id: string
          reason: string | null
          scope_key: string
          source_id: string
        }
        Insert: {
          active?: boolean
          actor_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          scope_key: string
          source_id: string
        }
        Update: {
          active?: boolean
          actor_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          scope_key?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_suppressions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
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
      strategy_statements: {
        Row: {
          approvals: Json
          created_at: string
          created_by: string | null
          id: string
          scope_key: string
          sector_code: string
          seven_part: Json
          sources: Json
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approvals?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          scope_key: string
          sector_code: string
          seven_part?: Json
          sources?: Json
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approvals?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          scope_key?: string
          sector_code?: string
          seven_part?: Json
          sources?: Json
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      studies: {
        Row: {
          config: Json
          country_code: string
          created_at: string
          id: string
          kind: string
          objective: string | null
          owner_country_code: string | null
          owner_user_id: string | null
          segment_id: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          config?: Json
          country_code: string
          created_at?: string
          id?: string
          kind: string
          objective?: string | null
          owner_country_code?: string | null
          owner_user_id?: string | null
          segment_id?: string | null
          status?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          config?: Json
          country_code?: string
          created_at?: string
          id?: string
          kind?: string
          objective?: string | null
          owner_country_code?: string | null
          owner_user_id?: string | null
          segment_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "studies_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "persona_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      study_questions: {
        Row: {
          created_at: string
          id: string
          kind: string
          options: Json
          ord: number
          prompt: string
          study_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          options?: Json
          ord: number
          prompt: string
          study_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          ord?: number
          prompt?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_questions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      study_reports: {
        Row: {
          citations: Json
          created_at: string
          id: string
          study_id: string
          summary_md: string
          themes: Json
          updated_at: string
        }
        Insert: {
          citations?: Json
          created_at?: string
          id?: string
          study_id: string
          summary_md?: string
          themes?: Json
          updated_at?: string
        }
        Update: {
          citations?: Json
          created_at?: string
          id?: string
          study_id?: string
          summary_md?: string
          themes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_reports_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: true
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      study_responses: {
        Row: {
          answer: Json
          citations: Json
          created_at: string
          id: string
          model: string | null
          persona_id: string
          question_id: string | null
          rationale: string | null
          study_id: string
        }
        Insert: {
          answer?: Json
          citations?: Json
          created_at?: string
          id?: string
          model?: string | null
          persona_id: string
          question_id?: string | null
          rationale?: string | null
          study_id: string
        }
        Update: {
          answer?: Json
          citations?: Json
          created_at?: string
          id?: string
          model?: string | null
          persona_id?: string
          question_id?: string | null
          rationale?: string | null
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_responses_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "study_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_responses_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      study_transcripts: {
        Row: {
          citations: Json
          created_at: string
          id: string
          ord: number
          persona_id: string | null
          speaker: string
          study_id: string
          utterance: string
        }
        Insert: {
          citations?: Json
          created_at?: string
          id?: string
          ord: number
          persona_id?: string | null
          speaker: string
          study_id: string
          utterance: string
        }
        Update: {
          citations?: Json
          created_at?: string
          id?: string
          ord?: number
          persona_id?: string | null
          speaker?: string
          study_id?: string
          utterance?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_transcripts_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_transcripts_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
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
      series_freshness: {
        Row: {
          age_days: number | null
          confidence_grade: string | null
          country_code: string | null
          frequency: string | null
          last_period: string | null
          metric: string | null
          points_count: number | null
          sector_code: string | null
          series_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "series_sector_code_fkey"
            columns: ["sector_code"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      country_chunks_search: {
        Args: {
          _country_code: string
          _limit?: number
          _query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          distance: number
          id: string
          source_id: string
          source_org: string
          source_title: string
          source_url: string
        }[]
      }
      find_story_cluster: {
        Args: { _country: string; _norm_title: string; _since: string }
        Returns: {
          primary_id: string
          similarity: number
          story_key: string
        }[]
      }
      has_country_access: {
        Args: { _country_code: string; _user_id: string }
        Returns: boolean
      }
      has_country_role: {
        Args: {
          _country_code: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      replace_country_sectors: {
        Args: { _country_code: string; _rows: Json }
        Returns: number
      }
      replace_ministry_sectors: {
        Args: { _country_code: string; _rows: Json }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
        | "country_admin"
      scenario_status: "draft" | "shared" | "adopted" | "archived"
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
        "country_admin",
      ],
      scenario_status: ["draft", "shared", "adopted", "archived"],
    },
  },
} as const
