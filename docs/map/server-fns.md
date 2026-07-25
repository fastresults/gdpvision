# Server functions map (generated)

Regenerate with `bun run map`. Do not hand-edit.

Each row is one `*.functions.ts` module. Header tags (`@domain`, `@tables`, `@ui`)
are lifted from the top-of-file docblock — add them to any module missing them.

| Module | Exports | @domain | @tables | @ui |
|--------|---------|---------|---------|-----|
| `src/lib/admin.functions.ts` | listAdminUsers, grantRole, revokeRole, addBinding, removeBinding, setDefaultBinding, listCountries, listInstanceConfig, setInstanceConfig, listAuditLog, inviteUser | — | — | — |
| `src/lib/api/example.functions.ts` | getGreeting | — | — | — |
| `src/lib/audits.functions.ts` | runKeyingAudit, listKeyingAudits | — | — | — |
| `src/lib/briefing.functions.ts` | submitBriefingRequest | — | — | — |
| `src/lib/cabinet.functions.ts` | getRoomOverview, createCabinetSession, getSession, saveAgendaItem, deleteAgendaItem, reorderAgenda, generateAgendaBrief, saveAttendance, recordAgendaOutcome, closeSession, listRegister, updateCommitment, getMinutes, addSignalToAgenda, getDecisionQueue, getMinistryReadiness, getCommitmentsCockpit, getSituationBrief, generateSituationBrief | — | — | — |
| `src/lib/cadence.functions.ts` | runCadenceClose, listCadenceHistory | — | — | — |
| `src/lib/categories.functions.ts` | listCategories, createCategory, updateCategory, deleteCategory, moveCategory | — | — | — |
| `src/lib/citations.functions.ts` | getCitations, saveCitations, listCitationCandidates | — | — | — |
| `src/lib/concierge/concierge-ai.functions.ts` | interpretIntent, draftRequestCard | — | — | — |
| `src/lib/concierge/concierge.functions.ts` | getMyDraft, saveDraft, discardDraft, submitRequest, listMyRequests, getRequest, listAgencyRequests, updateRequestStatus, attachDeliverable, markDeliverableRead | — | — | — |
| `src/lib/config.functions.ts` | listCountryPacks, previewCountryPack, activateCountryPack, deactivateCountryPack, generateNationalSignature | — | — | — |
| `src/lib/console/console.functions.ts` | getConsoleStudy | — | — | — |
| `src/lib/corpus/audit.functions.ts` | getCorpusAuditSummary, getCorpusMissStatus, redriveCorpusMisses | — | — | — |
| `src/lib/counsel.functions.ts` | askCounsel, askCounselDeepResearch, expoundCounsel, listCounselArchive | — | — | — |
| `src/lib/country-admin.functions.ts` | getMyCountryStatus, requestCountryAccess, listCountryAccessRequests, decideCountryAccessRequest, listCountryUsers, setCountryRole, removeCountryBinding, getCountryAdminOverview, setCountryGdp, saveSectorComposition, saveMinistries | — | — | — |
| `src/lib/country-data/consume.functions.ts` | listCountryKpis | — | — | — |
| `src/lib/country-data/manage.functions.ts` | listSources, upsertSource, toggleSource, deleteSource, reingestSource, listKpis, updateKpi, acceptKpiInference, overrideKpi, rejectKpiInference, reinferKpi, inferAllMissing, acceptAllHighConfidenceInferences, listSourceCandidates, approveSourceCandidate, rejectSourceCandidate, listDossiers, listMinistryProfiles, updateMinisterProfile, corpusStats, corpusDetail, semanticSearch, listMemory, listAllMemory, upsertMemory, setMemoryVerified, deleteMemory, bulkUpsertMemory, extractMemoriesFromText, extractMemoriesFromSourceId, extractMemoriesFromUrl, getSourceDetail, summarizeSource, bulkAddLinks, registerConnection, ingestDocumentSource | — | — | — |
| `src/lib/country-home/summary.functions.ts` | getCountryHomeSummary | — | — | — |
| `src/lib/country-onboarding/agents.functions.ts` | listOnboardingCountries, getOnboardingStatus, runProfileAgent, runGdpAgent, runSectorCompositionAgent, runMinistriesAgent, runMinistrySectorMapAgent, listCountryAuthorizedDomains, demoteCountryAuthorizedDomain, commitProfile, commitGdp, commitSectorComposition, commitMinistries, commitMinistrySectorMap, assertSuperAdmin, getPerplexityKeyStatus, listOnboardingRuns | — | — | — |
| `src/lib/country-onboarding/corpus.functions.ts` | runSourceRegistryAgent, commitSourceRegistry, cleanInvalidCountrySources, getRunProgress, runKpiSeedAgent, planKpiSeed, runKpiSeedSweep, resolveNextKpiSeedItem, finalizeKpiSeedRun, commitKpis, backfillMissingKpis, reverifyAllKpis, listKpiCoverage, runSectorDossierAgent, commitSectorDossiers, planMinistryDeepDive, resolveNextMinistryDeepDive, finalizeMinistryDeepDive, commitMinistryDeepDive, runCorpusIngest, runSecondBrainSeedAgent, commitSecondBrainSeed, runCapitalFlowsAgent, commitCapitalFlows, getIngestKeysStatus | — | — | — |
| `src/lib/country-onboarding/minister-backfill.functions.ts` | startMinisterBackfill, getMinisterBackfillRun, listMinisterBackfillRuns, cancelMinisterBackfillRun, backfillMinisters | — | — | — |
| `src/lib/country-onboarding/orchestrator.functions.ts` | getNextOnboardingStage, advanceCountryOnboarding, clearOnboardingLocks | — | — | — |
| `src/lib/country-onboarding/party-backfill.functions.ts` | startPartyBackfill, getPartyBackfillRun, listPartyBackfillRuns, cancelPartyBackfillRun | — | — | — |
| `src/lib/country-onboarding/summaries.functions.ts` | generateStageSummary, listStageSummaries | — | — | — |
| `src/lib/country-viz/flows.functions.ts` | getCapitalFlows | — | — | — |
| `src/lib/country-viz/viz.functions.ts` | getVizOverview, getSectorEvidence | — | — | — |
| `src/lib/documents.functions.ts` | renderDocument, listDocuments, getDocumentHtml | — | — | — |
| `src/lib/dossier.functions.ts` | getDossier, generateDossierQuestions, updateDossierQuestion | — | — | — |
| `src/lib/factcheck.functions.ts` | factCheckBody, assertApprovalFactCheck | — | — | — |
| `src/lib/fdi-resilience.functions.ts` | listStudioContext, listThreats, getThreat, createThreat, regenerateThreatBrief, suggestResilientStrategy, saveStrategy, promoteStrategyToPackages, promoteStrategyToScenario, updateThreat, deleteThreat | — | — | — |
| `src/lib/galleries.functions.ts` | listGalleries, listAllGalleryItems, createGallery, updateGallery, deleteGallery, moveGallery, addGalleryItem, updateGalleryItem, deleteGalleryItem, moveGalleryItem | — | — | — |
| `src/lib/goalseek.functions.ts` | solveForTarget | — | — | — |
| `src/lib/idle-images.functions.ts` | listIdleImages, addIdleImage, updateIdleImage, removeIdleImage, moveIdleImage | — | — | — |
| `src/lib/invitations.functions.ts` | createInvitation, listInvitations, revokeInvitation, getInvitationByToken, acceptInvitation, checkAccessAllowed | — | — | — |
| `src/lib/items.functions.ts` | uploadEventVideo, listItems, createItem, updateItem, refreshFavicons, deleteItem, moveItem, generateItemThumbnail, refreshAllThumbnails | — | — | — |
| `src/lib/ledger-qa/backfill.functions.ts` | backfillCapitalFlows, backfillSectors, backfillMinistryProfiles, backfillKpiSeries, getRecentCorpusAttempts | — | — | — |
| `src/lib/ledger-qa/diagnose.functions.ts` | diagnoseFinding | — | — | — |
| `src/lib/ledger-qa/probes.functions.ts` | tombstoneQaProbes | — | — | — |
| `src/lib/ledger-qa/remediate.functions.ts` | repairInvalidSourceUrls, retryUnreachableSources, recentQaActions | — | — | — |
| `src/lib/ledger-qa/self-heal.functions.ts` | runSelfHealingAcceptance | — | — | — |
| `src/lib/ledger.functions.ts` | getInstanceOverview, listInstanceBindings, getSectorDetail, getExposureHistory, getStewardshipQueue, explainFigure, pinFigureSnapshot, listFigureSnapshots, getLedgerEnrichment, getTrustSignals, acknowledgeGradeAlert, askTheLedger, transcribeAudio, getReconciliationReport, saveReconciliationNote, getSourceHealth, runSourceHealthChecks, getPublishGate, handoffFigure, expandLedgerAnswer | — | — | — |
| `src/lib/mandate.functions.ts` | getGap, savePackage, listKpis, saveKpi, listSessions, createSession, listCommitments, updateCommitmentStatus, recordDecision, logExport, listExports | — | — | — |
| `src/lib/media.functions.ts` | listMedia, uploadMedia, renameMedia, deleteMedia, setItemFaviconAsset | — | — | — |
| `src/lib/narrative-chamber.functions.ts` | listSignals, getSignal, ingestSignalFromUrl, redriveSignal, generateStrategyDraft, generateChannelDraft, publishArtifact, listArtifactsForSignal | — | — | — |
| `src/lib/narrative.functions.ts` | listMemoryObjects, upsertMemoryObject, listIntake, createIntake, decideIntake, listStrategies, getStrategy, saveStrategy, listComms, getComms, saveComms, approveComms, getCoverage, searchComms, getCommsDetail, updateCommsMeta, duplicateComms, deleteComms, listCommsFacets, listCommsWorkflowCounts, transitionCommsState, scheduleComms, saveCommsAsTemplate, restoreCommsRevision, updateCommsBody, backfillCommsTitles | — | — | — |
| `src/lib/narrative/opposition-intake.functions.ts` | listOppositionItems, getOppositionItem, signOppositionUpload, createOppositionItem, archiveOppositionItem | — | — | — |
| `src/lib/narrative/opposition-plan.functions.ts` | analyzeOppositionItem, generateOppositionResponsePlan, publishOppositionPlanToComms | — | — | — |
| `src/lib/onboarding.functions.ts` | seedCountryPack | — | — | — |
| `src/lib/personas/autorun.functions.ts` | startAutorun, getAutorunStatus, cancelAutorun, runAutorunTick | — | — | — |
| `src/lib/personas/blueprint.functions.ts` | getBlueprint, composeBlueprint, suggestBriefAdditions, saveBlueprint, approveBlueprint | — | — | — |
| `src/lib/personas/compose-segments.functions.ts` | composeSegments | — | — | — |
| `src/lib/personas/compose-study.functions.ts` | composeStudy, composeStudyForSegment | — | — | — |
| `src/lib/personas/generate.functions.ts` | generatePersona, generateSegment, listPersonas, listSegments, getPersona, getSegment, deletePersona, deleteSegment | — | — | — |
| `src/lib/personas/parse-upload.functions.ts` | signUploadUrl, parseUpload | — | — | — |
| `src/lib/personas/project-brief.functions.ts` | getProjectBrief, saveProjectBrief, enrichProjectBrief, commitProjectBrief | — | — | — |
| `src/lib/personas/projects.functions.ts` | listProjects, createProject, renameProject, archiveProject, deleteProject | — | — | — |
| `src/lib/personas/study.functions.ts` | createStudy, draftStudyQuestions, runStudyResponses, runStudySynthesis, runStudy, synthesizeStudyProgram, getStudyProgramReport, listStudiesWithReports, listStudies, getStudy, askPersona, getPersonaChat, listPersonaChats | — | — | — |
| `src/lib/personas/transcribe.functions.ts` | transcribeAudio | — | — | — |
| `src/lib/personas/wizard.functions.ts` | createDraft, listDrafts, renameDraft, duplicateDraft, getDraft, saveDraft, deleteDraft, enrichBrief, listDeliverables, enrichOutcome, retryOutcomeAi, draftCast, commitStudy | — | — | — |
| `src/lib/press-monitor.functions.ts` | listFeeds, upsertFeed, deleteFeed, testFeed, runManualTick, lastHarvestRun, heatStrip24h, suggestFeeds, discoverSources, coverageFor, latestCronCoverage, reviveAndRediscover, reportMissingStory, listWatchlist, upsertWatchlistEntity, deleteWatchlistEntity, refreshWatchlistFeeds | — | — | — |
| `src/lib/ripple.functions.ts` | simulateRipple, listSectorEdges, upsertSectorEdge | — | — | — |
| `src/lib/scenarios.functions.ts` | listMinistries, getPortfolio, listScenarios, getScenario, runScenarioEngine, saveScenario, promoteScenario, narrateScenario | — | — | — |
| `src/lib/scenarios/recommend-scenario.functions.ts` | recommendScenario | — | — | — |
| `src/lib/scenarios/suggest-playbooks.functions.ts` | suggestPlaybooks | — | — | — |
| `src/lib/scenarios/synthesize-levers.functions.ts` | synthesizeLevers, listLeverDrafts, activateLatestLeverDraft, commitLeverDraft | — | — | — |
| `src/lib/sector-dossier/build.functions.ts` | buildSectorDossier, getSectorContext | — | — | — |
| `src/lib/sector-dossier/prewarm.functions.ts` | prewarmSectorDossiers | — | — | — |
| `src/lib/settings.functions.ts` | listSettings, updateSetting | — | — | — |
| `src/lib/traceability.functions.ts` | linkArtifactToSignal, getTrace | — | — | — |
