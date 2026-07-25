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

---

## Cross-cutting surfaces

- **Concierge** (voice-first advice): `src/routes/_authenticated/concierge.{index,new,$id}.tsx` · `src/lib/concierge/{concierge,concierge-ai}.functions.ts` · `minister-lexicon.ts`
- **Country Home / Landing** (per country): `country.$code.tsx` · `country-home/summary.functions.ts` · `components/country/*`
- **Second brain viewer**: `admin/brain.tsx` · `narrative/brain.tsx` · `components/country-data/BrainConstellation.tsx`, `MemoryVisual.tsx`
- **Marketing**: `routes/index.tsx` · `components/marketing/*`
