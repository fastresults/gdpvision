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
      cabinet_sessions: {
        Row: {
          agenda: Json
          classification: string
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
          classification?: string
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
          classification?: string
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
          owner_id: string
          owner_type: string
          position_offset: number | null
          quote: string | null
          scope_key: string
          sector_code: string | null
          updated_at: string
        }
        Insert: {
          bucket?: string | null
          created_at?: string
          created_by: string
          id?: string
          memory_object_id?: string | null
          owner_id: string
          owner_type: string
          position_offset?: number | null
          quote?: string | null
          scope_key: string
          sector_code?: string | null
          updated_at?: string
        }
        Update: {
          bucket?: string | null
          created_at?: string
          created_by?: string
          id?: string
          memory_object_id?: string | null
          owner_id?: string
          owner_type?: string
          position_offset?: number | null
          quote?: string | null
          scope_key?: string
          sector_code?: string | null
          updated_at?: string
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
          country_code: string
          created_at: string
          created_by: string | null
          decision_id: string | null
          due_at: string | null
          id: string
          ministry_id: string | null
          owner_id: string | null
          status: string
          title: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          id?: string
          ministry_id?: string | null
          owner_id?: string | null
          status?: string
          title: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          id?: string
          ministry_id?: string | null
          owner_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
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
      comms_artifacts: {
        Row: {
          approvals: Json
          audience: string
          body: string
          channel: string
          created_at: string
          created_by: string | null
          draft_state: string
          id: string
          kind: string
          released_at: string | null
          scope_key: string
          strategy_id: string | null
          updated_at: string
        }
        Insert: {
          approvals?: Json
          audience: string
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          draft_state?: string
          id?: string
          kind: string
          released_at?: string | null
          scope_key: string
          strategy_id?: string | null
          updated_at?: string
        }
        Update: {
          approvals?: Json
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          draft_state?: string
          id?: string
          kind?: string
          released_at?: string | null
          scope_key?: string
          strategy_id?: string | null
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
      country_kpi_points: {
        Row: {
          country_kpi_id: string
          created_at: string
          id: string
          period: string
          source_id: string | null
          source_url: string | null
          value: number
        }
        Insert: {
          country_kpi_id: string
          created_at?: string
          id?: string
          period: string
          source_id?: string | null
          source_url?: string | null
          value: number
        }
        Update: {
          country_kpi_id?: string
          created_at?: string
          id?: string
          period?: string
          source_id?: string | null
          source_url?: string | null
          value?: number
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
          provenance: string
          research_notes: string | null
          source_id: string | null
          source_url: string | null
          target: number | null
          unit: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
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
          provenance?: string
          research_notes?: string | null
          source_id?: string | null
          source_url?: string | null
          target?: number | null
          unit: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
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
          provenance?: string
          research_notes?: string | null
          source_id?: string | null
          source_url?: string | null
          target?: number | null
          unit?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
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
        }
        Insert: {
          chunk_index: number
          content: string
          country_code: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          country_code?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
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
          raw_text: string
        }
        Insert: {
          char_count: number
          chunk_count?: number
          content_hash?: string | null
          country_source_id: string
          created_at?: string
          fetched_at?: string
          id?: string
          raw_text: string
        }
        Update: {
          char_count?: number
          chunk_count?: number
          content_hash?: string | null
          country_source_id?: string
          created_at?: string
          fetched_at?: string
          id?: string
          raw_text?: string
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
          quality_score: number
          storage_path: string | null
          summary: string | null
          summary_generated_at: string | null
          tags: string[]
          title: string
          tld: string | null
          updated_at: string
          url: string
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
          quality_score?: number
          storage_path?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          tags?: string[]
          title: string
          tld?: string | null
          updated_at?: string
          url: string
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
          quality_score?: number
          storage_path?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          tags?: string[]
          title?: string
          tld?: string | null
          updated_at?: string
          url?: string
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
        ]
      }
      decisions: {
        Row: {
          body: string | null
          country_code: string
          id: string
          mandate_id: string | null
          recorded_at: string
          recorded_by: string | null
          session_id: string
          title: string
        }
        Insert: {
          body?: string | null
          country_code: string
          id?: string
          mandate_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          title: string
        }
        Update: {
          body?: string | null
          country_code?: string
          id?: string
          mandate_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          title?: string
        }
        Relationships: [
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
          final_weight: number | null
          harvest_run_id: string | null
          id: string
          proposed_weight: number
          reviewed_at: string | null
          reviewed_by: string | null
          scope_key: string
          sector_code: string
          source_id: string | null
          state: string
          summary: string | null
          topic: string
          url: string | null
        }
        Insert: {
          created_at?: string
          final_weight?: number | null
          harvest_run_id?: string | null
          id?: string
          proposed_weight?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_key: string
          sector_code: string
          source_id?: string | null
          state?: string
          summary?: string | null
          topic: string
          url?: string | null
        }
        Update: {
          created_at?: string
          final_weight?: number | null
          harvest_run_id?: string | null
          id?: string
          proposed_weight?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_key?: string
          sector_code?: string
          source_id?: string | null
          state?: string
          summary?: string | null
          topic?: string
          url?: string | null
        }
        Relationships: [
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
      levers: {
        Row: {
          bounds: Json
          country_code: string
          created_at: string
          id: string
          methodology_ref: string | null
          name: string
          response_fn_ref: string
          sector_code: string
          slug: string
          unit: string
          updated_at: string
        }
        Insert: {
          bounds?: Json
          country_code: string
          created_at?: string
          id?: string
          methodology_ref?: string | null
          name: string
          response_fn_ref?: string
          sector_code: string
          slug: string
          unit: string
          updated_at?: string
        }
        Update: {
          bounds?: Json
          country_code?: string
          created_at?: string
          id?: string
          methodology_ref?: string | null
          name?: string
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
          payload: Json
          scope_key: string
          sector_code: string
          source_id: string | null
          title: string
          updated_at: string
          verified: boolean
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          kind: string
          payload?: Json
          scope_key: string
          sector_code: string
          source_id?: string | null
          title: string
          updated_at?: string
          verified?: boolean
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          kind?: string
          payload?: Json
          scope_key?: string
          sector_code?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
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
          programmes: Json
          source_ids: string[]
          updated_at: string
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
          programmes?: Json
          source_ids?: string[]
          updated_at?: string
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
          programmes?: Json
          source_ids?: string[]
          updated_at?: string
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
          promoted_domain: boolean
          published_at: string | null
          quote: string | null
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          domain_tier?: string | null
          draft_id: string
          id?: string
          promoted_domain?: boolean
          published_at?: string | null
          quote?: string | null
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          domain_tier?: string | null
          draft_id?: string
          id?: string
          promoted_domain?: boolean
          published_at?: string | null
          quote?: string | null
          title?: string | null
          url?: string
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
      sector_dossiers: {
        Row: {
          citations: Json
          confidence: string
          country_code: string
          created_at: string
          id: string
          kind: string
          payload: Json
          sector_code: string
          source_ids: string[]
          updated_at: string
        }
        Insert: {
          citations?: Json
          confidence?: string
          country_code: string
          created_at?: string
          id?: string
          kind: string
          payload: Json
          sector_code: string
          source_ids?: string[]
          updated_at?: string
        }
        Update: {
          citations?: Json
          confidence?: string
          country_code?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          sector_code?: string
          source_ids?: string[]
          updated_at?: string
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
          source_org: string
          source_title: string
          source_url: string
        }[]
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
