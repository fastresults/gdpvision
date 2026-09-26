# Chambers map

Each of the 7 chambers = a route surface + component tree + server-fn module(s) + tables. When you touch a chamber, start here.

---

## Chamber 01 · National Ledger

- **Admin route**: `src/routes/_authenticated/admin/countries.$code.ledger.tsx`
- **Console route**: `src/routes/_authenticated/console.$code.index.tsx` (Study), `console.$code.ask.tsx` (Ask), `console.$code.request.new.tsx` (Send)
- **Components**: `src/components/ledger/*` — `AskTheLedger`, `AskProgress`, `WhyThisNumberPanel`, `LedgerEnrichments`, `TrustSignals`, `ExpandActions`, `ArtifactPanel`, `StewardTools`
- **Server fns**: `src/lib/ledger.functions.ts`, `src/lib/ledger-qa/{diagnose,probes,remediate,backfill,self-heal}.functions.ts`
- **Tables**: `country_kpis`, `country_kpi_points`, `ledger_probes`, `ledger_remediations`
- **Related helpers**: `ledger-qa/remediators.ts`, `ledger-qa/capital-flow-acceptance.server.ts`

## Chamber 02 · Portfolios

- **Route**: `admin/countries.$code.portfolio.{index,$ministry}.tsx`
- **Instrument surface**: `_authenticated/instrument/portfolio.{index,$ministry}.tsx`
- **Components**: `src/components/viz/MinistrySectorHeatmap.tsx`, `SectorProfilingMatrix.tsx`, `SectorSparkstrip.tsx`, `SectorTrendBars.tsx`, `sector/SectorDossierDrawer.tsx`
- **Server fns**: `src/lib/mandate.functions.ts`, `src/lib/sector-dossier/{prewarm,build}.functions.ts`, `src/lib/country-viz/{viz,flows}.functions.ts`
- **Tables**: `ministry_profiles`, `ministry_sectors`, `sector_profiles`, `sector_dossiers`

## Chamber 03 · Scenarios

- **Route**: `admin/countries.$code.scenarios.{index,new,$id,compare}.tsx`
- **Instrument**: `_authenticated/instrument/scenarios.*`
- **Components**: `src/components/scenarios/*` — `GdpFanChart`, `LeversDrawer`, `LeverRowV2`, `LeverDraftReview`, `PlaybookChips`, `PlaybookCard`, `NarrativePanel`, `SectorWaterfall`, `SensitivityMini`, `TornadoStrip`, `CompareSlots`, `CompensationLedger`, `AttributionStack`, `AiRecommendDrawer`, `AiPlaySuggestions`
- **Server fns**: `src/lib/scenarios.functions.ts`, `src/lib/scenarios/{recommend-scenario,suggest-playbooks,synthesize-levers}.functions.ts`, helper `scenarios/lever-draft-commit.server.ts`
- **Engine**: `src/lib/scenarios/local-engine.ts`, `scenarios/compensation.ts`, `scenarios/playbooks.ts`, `src/lib/engine/v1_macro.ts`

## Chamber 04 · FDI Transition Studio

- **Route**: `admin/countries.$code.studio.{index,threats.$id}.tsx`
- **Instrument**: `_authenticated/instrument/studio.{gap,packages}.tsx`
- **Components**: `src/components/studio/*` — `WorkbenchJourney`, `ThreatBriefCard`, `ThreatComposer`, `ThreatEditorDialog`, `ThreatStepper`, `ExposureLedger`, `ResilienceActionsRail`, `ReallocationMarimekko`, `StagingTimeline`, `StressTestPanel`, `CommitBar`, `GuidanceBanner`, `EmptyStrategyCoach`
- **Server fns**: `src/lib/fdi-resilience.functions.ts`, `src/lib/goalseek.functions.ts`, `src/lib/ripple.functions.ts`
- **Presets**: `src/components/studio/threat-presets.ts`, `existential-threats.ts`

## Chamber 05 · Narrative (+ Opposition Intel)

- **Route**: `admin/countries.$code.narrative.{index,library,signal.$id,opposition.index,opposition.$id}.tsx` and cross-country `_authenticated/narrative/*`
- **Components (signals)**: `src/components/narrative/*` — `SignalTriageRail`, `SignalRow`, `SignalSourcesPanel`, `DraftStudio`, `StrategyPanel`, `RadarHeatStrip`, `DossierCard`, `CitationsRail`, `DayClock`, `CoverageBadge`, `PriorityPill`, `LineageChevron`, `NarrativeJourney`, `RecommendationChip`, `AddSignalDialog`
- **Components (opposition)**: `src/components/narrative/opposition/*` — `OppositionStepper`, `OppositionDetail`, dropzone + counter-campaign panel
- **Components (comms)**: `src/components/narrative/comms/*`
- **Server fns**: `src/lib/narrative.functions.ts`, `src/lib/narrative-chamber.functions.ts`, `src/lib/narrative/{opposition-intake,opposition-plan}.functions.ts`, `src/lib/narrative/opposition-analysis.server.ts`, `src/lib/press-monitor.functions.ts`, helpers `press-discover.server.ts`, `press-tick.server.ts`, `story-cluster.server.ts`, `narrative-watchlist.server.ts`, `suppressions.server.ts`
- **Tables**: `narrative_signals`, `narrative_drafts`, `narrative_strategies`, `narrative_dossiers`, `opposition_items`, `opposition_response_plans`, `press_articles`

## Chamber 06 · Cabinet Room

- **Route**: `admin/countries.$code.cabinet.{index,session.$sid,agenda.$sid,minutes.$sid}.tsx`
- **Instrument**: `_authenticated/instrument/cabinet.{index,decisions,session}.tsx`
- **Components**: `src/components/cabinet/*` — `SituationBoard`, `SituationHero`, `DecisionQueue`, `CommitmentsCockpit`, `MinistryReadinessMatrix`, `StateOfNationBrief`, `primitives`
- **Server fns**: `src/lib/cabinet.functions.ts`, `src/lib/briefing.functions.ts`, `src/lib/cadence.functions.ts`

## Chamber 07 · Persona Lab

- **Route**: `admin/countries.$code.personas.{index,blueprint,segments,studies,studies.$id,$id}.tsx`
- **Components**: `src/components/personas/*` — `StudyWizard/{WizardModal,ProgramBriefIntake,MultimodalInput,BlueprintReview,ProgramSynthesisCard,ProgramsIndex,ProjectSwitcher,SessionsHub,StudioStatusRail,SynthesisDigest,AutoRunConsole}`, `GuidedStepper`, `JourneyCard`, `StudioStepper`
- **Hooks**: `src/hooks/useProgramBriefGate.ts`, `useVoiceRecorder.ts`
- **Server fns**: `src/lib/personas/{wizard,study,generate,blueprint,projects,project-brief,parse-upload,transcribe,compose-study,compose-segments,autorun}.functions.ts`, helper `personas/context-pack.server.ts`, `personas/study-autorun.ts`, `personas/report-export.ts`

## Chamber 08 · Mandate Compact

- **Route**: `admin/countries.$code.mandate-compact.tsx`
- **Components (inline in route)**: `Stepper`, `IngestPanel`, `CompactList`, `StatusPill`, `PhasePlaceholder`
- **Server fns**: `src/lib/mandate-compact/{ingest,list}.functions.ts`
- **Tables**: `mandate_compacts`, `compact_pillars`, `compact_pledges`, `compact_deliverables`, `compact_status_updates`, `compact_scorecards`, `compact_revisions` + writes to `country_manifestos`, `country_sources`, `country_source_documents`, `country_source_chunks`, `memory_objects`
- **Corpus**: manifesto text is chunk-embedded via `country-onboarding/ingest.server.ts` (chunkText + embedBatch) so Ask-the-Ledger can quote pledges verbatim; a `memory_object` of kind `mandate_compact` mirrors the compact for cross-chamber lookup

## Chamber 09 · Digital Government Studio

- **Routes**: `admin/countries.$code.egov.tsx` (PRD list + scope wizard), `admin/countries.$code.egov_.$prdId.tsx` (section editor, provenance, approval, brand, share), `admin/countries.$code.egov_.$prdId_.document.tsx` (print view), public `e.$token.tsx`
- **Components**: `src/components/egov/{NewPrdPanel,SectionEditor,ApprovalPanel,BrandPreview,SharePanel,PrdDocument}.tsx`, `labels.ts`
- **Server fns**: `src/lib/egov/{prd,draft,share-links,public-prd}.functions.ts`; context packs in `egov/context.server.ts`; stages in `egov/stages.ts`; brand tokens in `egov/brand.ts`; markdown export in `egov/markdown.ts`
- **Tables**: `egov_prds`, `egov_prd_sections`, `egov_prd_citations`, `egov_prd_snapshots`, `egov_prd_share_links` (drizzle/migrations/0012); history via `log_governance` → `audit_log`
- **Governance**: `egov_prds_guard` enforces the status machine, two-person rule and `can_approve_egov` (country_admin, cabinet_secretary); a section edit on a submitted/approved PRD reopens it; approval refuses out-of-date sections. Sole-approver exception (migration 0014): a global admin may approve their own submission only when no other approver is bound to the country; stamped `approval_mode = sole_admin` and logged as not counter-signed
- **Drafting**: one stage per call (`draftSection`), in `EGOV_STAGES` order; the model sees only the stage's context pack (corpus rows + scope + brand tokens + the bundled `AGENTS.md`/chamber map for the architecture stage) and must cite pack keys; unsupported sections are recorded as gaps
- **Staleness**: `checkStale` re-hashes each pack's corpus lines and marks changed sections `stale`
- **Platform connection**: public API v1 for the country's e-government platform — `src/routes/api/public/v1/{handshake,countries.$code.$resource}.ts`, contract in `src/lib/egov/api.server.ts`, keys in `egov/api-keys.functions.ts` (`egov_api_keys`, migration 0013), UI `components/egov/ConnectionPanel.tsx`; brand payload carries flag-as-logo/favicon (`MARKS_USAGE`) and the imagery plan (`IMAGERY_SPEC`) from `egov/brand.ts`
- **Explain**: `src/lib/explain/egov-entries.ts` (`egov.*`)
- **Next phases** (see `prds/PRD-digital-government-studio.md` in the working folder): live repo reads + PRD commits to `content/egov/<CODE>/`, daily staleness hook, public v1 API, scaffold of the country's own `egov-<code>` repository

## Chamber 10 · Sector Studio

- **Routes**: `admin/countries.$code.sector.tsx` (sector board: Scout shortlist, priorities, plans), `admin/countries.$code.sector_.$planId.tsx` (section editor, agent, Auditor notes, approval, Cabinet commitment), `admin/countries.$code.sector_.$planId_.document.tsx` (print view)
- **Components**: `src/components/sector/{SectorBoard,NewPlanPanel}.tsx`, `labels.ts`; reuses `egov/{SectionEditor,ApprovalPanel,PrdDocument}`
- **Server fns**: `src/lib/sector/{plan,draft,scout}.functions.ts`; context packs in `sector/context.server.ts` (country readers shared from `egov/context.server.ts` via `CORPUS_READERS`, plus sector readers and the bundled method); stages and agent roles in `sector/stages.ts`; model call in `sector/model.server.ts` (`SECTOR_MODEL`, falls back to `EGOV_MODEL`); Auditor in `sector/audit.ts`; markdown export in `sector/markdown.ts`
- **Method**: `docs/prd/sector-studio-framework.md` — five layers (Head of Government, minister, Sector Council, implementation plan, national sensitisation), seven ingredients, orchestration; bundled into every pack as `method.*` lines, so editing it marks drafted sections out of date
- **Tables**: `sector_shortlists`, `sector_priorities`, `sector_plans`, `sector_plan_sections`, `sector_plan_citations`, `sector_plan_snapshots` (drizzle/migrations/0018); history via `log_governance` → `audit_log`
- **Governance**: `sector_priorities_guard` caps active priorities at four and records the reason; `sector_plans_guard` requires a priority before a plan, enforces the status machine, the two-person rule with the sole-admin exception (`can_approve_sector`, `can_sole_approve_sector`), reopens edited plans, refuses out-of-date sections, supersedes the previous approved plan for the sector, and on approval inserts a Cabinet `commitments` row (sector_code, due at the plan horizon) and stores `commitment_id`
- **Orchestration**: Scout (`runScout`, one call over every sector) → human choice → per stage one agent role (Diagnostician, Strategist, Planner, Economist, Measurer, Drafter) via `draftPlanSection` → Auditor (deterministic: citations, KPI baseline/source/owner, project owner/funder/date/KPI, target consistency, items to confirm) → two-person approval
- **Executive Brief**: `resolveSector` in `executive/resolvers/office.server.ts`; chamber slug `sector`, index `10`
- **Public API**: `GET /api/public/v1/countries/<CODE>/sectors` carries `extra.priorities` and `extra.plans` (approved plans with their sections) under the existing `sectors` scope
- **Roles added** (Phase 2 use): `sector_minister`, `sector_council_chair`, `sector_council_member`, `delivery_lead`
- **Next phases**: Phase 2 operating system (project register, scorecard with baselines, decision and unblock ledger, Compact signing, scheduled packs); Phase 3 nation loop (public scorecard on the eGov platform, sensitisation toolkit, annual report, nightly Auditor)

## Strategic workspace · Sovereign Eye

- **Route**: `admin/countries.$code.godseye.tsx`
- **Public scene route**: `s.$token.tsx` (unbranded, public-layer scenes only)
- **Components**: `src/components/sovereign-eye/*` — `SovereignEyeWorkspace`, `RegionMap`, `LayerRail`, `EvidencePanel`
- **Server fns**: `src/lib/sovereign-eye.functions.ts`
- **Tables**: reads `countries`, `country_kpis`, `country_sectors`, `ministries`, `ministry_profiles`, `country_capital_flows`, `capital_flow_nodes`, `country_sources`, `memory_objects`; persists `sovereign_eye_scenes`
- **Live context**: public no-key weather and regional seismic feeds are read at request time and remain separate from committed corpus evidence
- **Sharing safety**: a scene can be published only when every selected layer contains zero private records

---

## Cross-cutting surfaces

- **Concierge** (voice-first advice): `src/routes/_authenticated/concierge.{index,new,$id}.tsx` · `src/lib/concierge/{concierge,concierge-ai}.functions.ts` · `minister-lexicon.ts`
- **Country Home / Landing** (per country): `country.$code.tsx` · `country-home/summary.functions.ts` · `components/country/*`
- **Second brain viewer**: `admin/brain.tsx` · `narrative/brain.tsx` · `components/country-data/BrainConstellation.tsx`, `MemoryVisual.tsx`
- **Marketing**: `routes/index.tsx` · `components/marketing/*`
