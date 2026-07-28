2# Executive Dashboard — the Principal's cockpit

A single screen, above the chambers, that answers: *what is my government doing right now, what is coming due, and what are the numbers*. Not a ninth chamber — a **roof** over the eight. Built to the standard of a printed sovereign brief, not a SaaS admin panel.

---

## Part 1 · The design thesis

The reference is not Datadog or Notion. It is **a Prime Minister's red box**: a leather folder opened at 6am containing one page that has already decided what matters. Everything below serves that metaphor.

**Five design laws for this surface:**

1. **One decision per glance.** The top third of the screen is never charts — it is a ranked, human-language list of what needs the Principal. Charts are evidence, placed below the verdict.
2. **Typographic hierarchy over chrome.** No card shadows, no rounded pills competing for attention, no coloured tiles. Depth comes from serif/mono contrast, hairline rules (`border-line-200`), and generous vertical rhythm — the existing GDPVision house style, pushed to its editorial extreme.
3. **Numbers are the only saturated thing on screen.** Colour is reserved exclusively for state (`--signal-positive` / `--signal-warn` / `--signal-negative`). A card with nothing wrong is entirely monochrome. This means risk is detectable in peripheral vision, in under a second, without reading a word.
4. **Uniform card anatomy = zero learning cost.** All eight chambers render through one component with identical slot positions. Once the Principal reads one card, they can read all eight without moving their eyes to new places.
5. **Silence is data.** A chamber with no activity is not hidden and not apologised for — it is rendered quiet and grey with a single line: *"No activity — 14 days."* Absence of work is itself an executive signal.

---

## Part 2 · The screen

```text
╔══════════════════════════════════════════════════════════════════╗
║  ▉ FLAG   SAINT LUCIA                        Tuesday 28 July     ║
║  Good morning, Prime Minister.                                   ║
║  GDP 2.42bn ·  +3.1% ·  grade B ·  corpus fresh 6h               ║
╠══════════════════════════════════════════════════════════════════╣
║  REQUIRES YOU                                        ── 4 items  ║
║  01 │ Cabinet convenes in 2 days — 4 decisions unprepared  →    ║
║  02 │ Signal escalating 18h, no response drafted           →    ║
║  03 │ 6 pledges past due · Health, Works                   →    ║
║  04 │ Tourism series stale 94 days — grade fell B→C        →    ║
╠══════════════════════════════════════════════════════════════════╣
║  THE EIGHT CHAMBERS                     [ Grid ] [ Ledger ]      ║
║ ┌───────────────┬───────────────┬───────────────┬──────────────┐ ║
║ │ 01            │ 02            │ 03            │ 04           │ ║
║ │ The National  │ Portfolio     │ Scenario      │ FDI          │ ║
║ │ Ledger        │ Workspaces    │ Engine        │ Studio       │ ║
║ │               │               │               │              │ ║
║ │  184   87%    │  12    9      │   6    2      │  4     11    │ ║
║ │  kpis  gradeA │  min   dossier│  live  adopted│  thr   acts  │ ║
║ │  ▁▂▃▅▆▇       │  ▂▂▃▃▄▄       │  ▃▅▂▆▇▃       │  ▇▆▄▃▂▁      │ ║
║ │  · 4h ago     │  · 3d ago     │  · 2h ago     │ ⚠ 14d ago    │ ║
║ │  Due Fri      │  —            │  Due Mon      │  Due 30d     │ ║
║ └───────────────┴───────────────┴───────────────┴──────────────┘ ║
║ ┌ 05 ─┬ 06 ─┬ 07 ─┬ 08 ─┐  (same anatomy, second row)            ║
╠══════════════════════════════════════════════════════════════════╣
║  WHAT IS DUE                                    next 30 days     ║
║  Fri 31  Narrative  Op-ed clearance        OPM        ●●●○○      ║
║  Mon 03  Cabinet    Session 24-08          Sec        ●●●●○      ║
║  Wed 12  Mandate    Health Q3 deliverable  Min Health ●○○○○      ║
╚══════════════════════════════════════════════════════════════════╝
```

### Innovations that earn the "award-winning" claim

- **The verdict rail, not a widget wall.** The first thing on screen is prose, ranked, with a jump link into the exact chamber view that resolves it. Every item is one sentence a human would say out loud. This is the single biggest departure from conventional dashboards, which open with charts and make the executive do the diagnosis.
- **Sparkline as the pulse of a chamber.** Each card carries a 30-day activity sparkline — not a business metric, but *tempo of work*. At a glance the Principal sees which chambers are alive and which have gone quiet. Nobody else's dashboard shows institutional tempo.
- **The Ledger toggle.** One control flips the eight cards into a single dense table sorted by next-due date — chamber view for orientation, ledger view for triage. Same data, two mental models, no navigation.
- **Attention scoring is visible, not magic.** Hovering a verdict item reveals *why* it ranked there ("overdue 6d · affects 2 ministries · Cabinet-linked"). Executives distrust black boxes; showing the arithmetic buys the trust.
- **Progressive disclosure by hover, deep-dive by click.** The card face carries 3 numbers. Hover raises a hairline overlay with the 3 most recent activity lines and the owning office. Click enters the chamber. Nothing is buried more than one interaction deep.
- **Print parity.** `@media print` renders the whole dashboard as a two-page brief in the house engraved style, so a Principal's aide can put it in the actual red box. This is a genuine differentiator for the government market.
- **Motion with restraint.** Numbers count up once on first paint (250ms, ease-out), sparklines draw left-to-right, verdict rows stagger in at 40ms intervals. Nothing loops, nothing pulses, nothing moves after the first second — a dashboard that fidgets reads as unserious.
- **Density that respects the room.** Desktop 4×2 grid; tablet 2×4; mobile a single-column stack where the verdict rail is the whole first screen and chambers become a swipeable row. Every header row uses the `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` pattern so nothing clips at 375px.

### Card anatomy — identical for all eight

Exactly: **3 KPIs** (tabular-nums, 2dp), **tempo sparkline**, **last-activity chip**, **next-due date**, hover-revealed **3 activity lines + owning office**, and one full-card `Enter` target. No chamber gets a bespoke layout, ever.

| # | Chamber | 3 KPIs | Next-due source |
|---|---|---|---|
| 01 | Ledger | KPIs on record · A/B-grade share · open QA issues | oldest stale series |
| 02 | Portfolios | ministries mapped · sectors dossiered · weakest portfolio | dossier refresh |
| 03 | Scenarios | live · adopted · best-case ΔGDP | scenario review |
| 04 | FDI Studio | threats logged · open playbook actions · exposure index | next horizon action |
| 05 | Narrative | signals open · drafts pending clearance · median response time | oldest untriaged signal |
| 06 | Cabinet | next session · decisions queued · commitments overdue | session date |
| 07 | Persona Lab | studies running · segments · responses collected | study close date |
| 08 | Mandate | on-track / at-risk / missed · delivery % | next deliverable date |

---

## Part 3 · Implementation

**1. Column audit first.** Each number must come from a column that actually exists. Step one is a read of the tables behind chambers 02–08 (`ministry_profiles`, `sector_dossiers`, `scenarios`, `fdi_threats`, `fdi_playbook_actions`, `intake_items`, `comms_artifacts`, `cabinet_sessions`, `decisions`, `commitments`, `studies`, `compact_pledges`, `compact_deliverables`) to confirm exact status/date columns. Where a metric has no backing column the card shows the empty-state contract (`— not yet on record`) — never a fabricated number. No schema changes planned; if a genuinely required timestamp is missing I'll flag it before adding one.

**2. One server function, eight resolvers.** `src/lib/executive/dashboard.functions.ts` → `getExecutiveDashboard({ country_code })`, `requireSupabaseAuth`, eight independent resolvers in `Promise.all` from `src/lib/executive/resolvers/*.server.ts`, each returning the same DTO:

```ts
{ index, title, kpis: [{label, value, tone, format}], tempo: number[],
  last_activity_at, next_due: {label, at} | null,
  recent: [{at, actor, text, href}], owner, health }
```

A failing resolver degrades to a null-filled quiet card — one broken chamber never blanks the dashboard.

**3. Activity + tempo without new plumbing.** Recent lines and the 30-day sparkline are derived from `created_at`/`updated_at` on each chamber's own tables (union'd, bucketed by day), plus existing `audit_log`. No event bus, no writes on the hot path.

**4. Attention rail = derived, deterministic.** `src/lib/executive/attention.ts` scores assembled DTOs into 3–5 ranked items with an explainable score breakdown (the hover tooltip). Pure rules, no AI call, so first paint is fast. A later "Brief me" button can hand the same DTO to the existing counsel pipeline.

**5. Routes.**
- `/_authenticated/admin/countries/$code/executive` — super-admin / country-admin.
- `/_authenticated/console/$code/brief` — the Principal's view, same components, mobile-first, reachable from the Study tab.
- `admin/country.$code.tsx` gains the verdict rail + chamber grid **above** `ChambersLauncher`; the launcher remains the pure navigation grid beneath.

**6. Components.** `src/components/executive/` — `ExecutiveDashboard`, `PrincipalMasthead`, `AttentionRail`, `AttentionRow`, `ChamberCard`, `KpiTriple`, `TempoSparkline`, `ChamberLedgerTable`, `DueLedger`, `ExecutiveSkeleton`. House rules enforced: `btn-*` utilities only, registered tokens only, tabular-nums on all figures, `<PrettyJson>` for any raw payload, one `spot` illustration in the masthead per the illustration contract. Loader primes with `ensureQueryData`; component reads `useSuspenseQuery`, 60s `staleTime`, per-card skeletons so the grid never reflows.

**7. Cross-workflow rule.** Codified in `AGENTS.md` + new `docs/map/executive.md`: *every chamber surface must export a resolver conforming to the ChamberSummary DTO.* That contract is how the dashboard stays truthful as chambers evolve, instead of decaying into a stale hardcoded panel. `bun run check:maps` will fail a PR that adds a chamber surface without one.

---

## Out of scope this pass

Email/WhatsApp digests, per-minister personalised filtering, AI-written weekly narrative summaries. All three become straightforward once the DTO layer exists.
