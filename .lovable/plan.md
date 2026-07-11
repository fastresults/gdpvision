## What's built vs. PRD §12 Key Screens (v1.0)

Mapping the current route tree against the PRD's 24-screen v1.0 inventory and the Phase 0–5 roadmap.

### Built (present as routes / functions)
- Ledger home, Sector Detail, CBI Exposure, Portfolio Workspace, Stewardship (Chamber 1)
- Scenario Builder / Compare / Detail (Chamber 3)
- FDI Studio: Gap + Package Builder (Chamber 4)
- Cabinet Room + Session Mode (Chamber 6)
- Mandate Studio + National Scorecard (Mandate)
- Narrative: Second Brain, Signal/Queue, Ingest, Coverage, Strategy Composer, Comms Studio + approval, hourly Harvest cron
- Counsel desktop + Archive

### Not yet built — screens
1. **Screen 0 — Country Configuration / provisioning** (CARICOM/OECS registry, Country Pack review, portfolio→sector mapping confirmation).
2. **Screen 10 — Context Dossier** (per-signal researched surround: facts, coverage map, precedent, prior statements, open questions). Signal cards exist; the dossier detail view does not.
3. **Screen 12b — Counsel mobile shell** (full-screen hold-mic, slide-up answer sheet, drawer to instrument). Desktop counsel exists; the phone-first surface does not.
4. **Screen 17 — The Codex** (methodology handbook browser).
5. **Screen 18 — Admin** (users, delegation, portfolio mapping, instance configuration).

### Not yet built — cross-cutting v1.0 requirements
6. **State coverage per screen** — PRD §12 requires empty / loading / error / stale-data states designed to the same standard as happy path. Most current routes only implement the happy path.
7. **National Signature generator** (Phase 0) — the generative identity artifact per country; not present.
8. **Methodology transparency surfaces** (FR-SE-09) — "why this number" drill-downs from Ledger/Scenario outputs into the Codex.
9. **Ledger fact-check at generation + approval** (FR-NC-11) — Comms artifacts detect fiscal figures and gate approval on a note, but do not yet run a live Ledger fact-check pass against numeric claims with citation binding.
10. **Retrieval citation rail** on Strategy Composer and Comms Studio drafts (PRD §12 screens 12/13 + DoD gate). Approval log exists; per-claim source citations bound to Second Brain objects do not.
11. **Signal → Dossier → Strategy → Release traceability** — the end-to-end link required by the Phase 4 milestone and DoD drill.
12. **Source suppression enforcement** across retrieval + citation (DoD gate). Table exists; enforcement in Counsel/Composer retrieval paths not wired.
13. **Counsel hardening for GA** — rate limits, per-instance provider budget caps, full audit trail with scenario snapshot binding on save (partial), auth on all voice endpoints verified.
14. **Universal country+sector keying audit** — automated audit that every object carries valid keys (DoD gate).
15. **Cadence engine** — monthly/quarterly/annual/term cadence closes with immutable KPI snapshots (Mandate Studio surfaces exist; the cadence-close job does not).
16. **Goal-seek** — set the target, discover the levers (§1.5, FR-SE, Mandate linkage).
17. **Ripple propagation** across sectors in the Scenario Engine (Phase 2 milestone). Scenario CRUD exists; cross-sector ripple math does not.
18. **Document export system** (Phase 3) — Cabinet decisions, briefings, package documents, term/State-of-the-Mandate export honoring PRD document rules.
19. **Decisions register** as a first-class surface (referenced by Cabinet Room but not its own workspace with export).
20. **Onboarding seed flow** for Position Library / Statement Record / Audience Registry (Phase 4 — "Second Brain launches pre-loaded").

### Phase 5 GA gates (not yet done)
- Security audit + auth verification on every Counsel/admin endpoint
- Accessibility audit (WCAG 2.2 AA; AAA for headline numbers + Session Mode)
- Reduced-motion parity, motion-token conformance, performance budget
- External economist methodology review and comms-doctrine review
- Award-submission asset prep

## Suggested next build order
1. Screen 0 (Country Configuration) — blocks credible provisioning of new instances.
2. Context Dossier (Screen 10) — closes the Signal→Strategy chain the Phase 4 milestone requires.
3. Fact-check + citation rail on Strategy/Comms — DoD gate; small edits on top of existing screens.
4. Admin (Screen 18) + Codex (Screen 17) — unblocks self-serve operation and methodology transparency.
5. Counsel mobile shell — front-door surface on phones.
6. Cadence engine + goal-seek + ripple — Mandate/Engine depth.
7. Document export system + decisions register export.
8. Empty/loading/error/stale states pass across all routes.
9. Phase 5 GA hardening.

Want me to break any of these into a build-ready plan?
