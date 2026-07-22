
# Country Console — a front layer, not a chamber launcher

## The mistake I made

I put the seven chambers directly on the country user's home page. The chambers are the **agency's** production floor. Country users (Ministers, Permanent Secretaries, Chiefs of Staff) should never see them, never click into them, and never be asked to understand what "The Narrative Chamber" or "The FDI Transition Studio" is.

The country user's mental model is simple: **"I have a problem in my ministry. I need something done. Send it to the team."** Everything else is our problem.

## The two audiences, cleanly separated

```text
COUNTRY USER (Minister / PS / staff)          AGENCY USER (Open Interactive)
─────────────────────────────────────         ──────────────────────────────
/console                                       /home  → seven chambers
  • Ask for something (AI wizard)              • Chamber 01 National Ledger
  • My requests (in progress / done)           • Chamber 02 Portfolio
  • My deliverables (finished work)            • Chamber 03 Scenario Engine
  • My ministries                              • …
  • My briefings / cabinet packet              • Concierge queue (inbound)
                                               • Fulfills using chambers
NEVER sees chambers.                           NEVER shown to country users.
```

Routing rule enforced at the root: on sign-in we look at the user's roles.
- Global admin (`admin`, no country) → `/home` (existing agency view with chambers).
- Country-scoped role (any role tied to a `country_code`) → `/console/$code`. They cannot reach `/admin/countries/**` even by typing the URL: the `_authenticated` gate now checks role scope and redirects country users back to `/console/$code`.
- Super-admin using "View as country user" impersonation → `/console/$code` rendered under the same country-user shell (same restrictions, banner still visible).

## The Country Console — what the user actually sees

One route tree, one shell, one vocabulary. No chamber names anywhere in copy or URLs.

**`/console/$code` — The Study (home)**

A calm, editorial dashboard organized around *the user*, not our systems.

1. **Masthead** — country name, flag mark, today's date. One-line status: "3 requests in progress · 2 deliverables waiting for you".
2. **"What do you need?" panel** — the single primary action. A large "Start a request" button that opens the AI wizard. Underneath it, three natural-language starter chips generated from the country's recent activity and ministries (e.g. *"Brief the Minister of Tourism on the cruise-tax proposal"*, *"Rehearse the FY26 VAT change before cabinet"*, *"Draft a public statement on the port incident"*). The chips are just seeded prompts — they still enter the same wizard.
3. **Waiting for you** — deliverables the agency has returned but the user hasn't opened. Each shows: what was asked, which ministry it belongs to, one-line summary, "Open" button. This is the payoff loop.
4. **In flight** — requests currently being worked on by the agency. Status in human terms: *Received · In research · In review · Ready soon · Delivered*. No chamber names, no stage numbers. ETA if we have one.
5. **My ministries** — the ministries this user is attached to (from `user_roles` / ministry assignment). Each is a card: minister name, portfolio, "3 open items". Clicking a ministry filters the console, it does NOT open a chamber.
6. **Cabinet & briefings** — a light strip that surfaces the next cabinet session and any prepared briefing packs *for this user*. Read-only rendering of already-produced artifacts; no "enter the Cabinet Room" link.

Nothing on this page ever navigates into `/admin/countries/$code/ledger|scenarios|narrative|cabinet|portfolio|studio|personas`. Those URLs are agency-only.

**`/console/$code/request/new` — Ask for something (AI-first wizard)**

The Concierge wizard, re-scoped and re-written entirely in minister language. Four short acts:

1. **What's on your mind?** — free-form textarea, voice-in, or attach a document/photo. AI listens.
2. **Which ministry does this belong to?** — AI proposes one from the text; user confirms or picks from their ministries.
3. **What outcome do you want?** — AI offers 2-3 concrete outcomes in plain English ("A cabinet-ready brief", "A public statement", "A short rehearsal of what happens if we do this", "A comparison of options"). User picks one; can add a sentence.
4. **When do you need it, and who else should see it?** — deadline chip, optional cc.

Submit produces a `service_request` row, drops the user back to `/console/$code` with the new request now showing in **In flight**. No chamber vocabulary anywhere; the mapping to chambers happens on the agency side.

**`/console/$code/requests` and `/console/$code/requests/$id`**

List and detail for the user's requests + their deliverables. Detail view shows: original ask, current status in plain English, timeline of updates from the agency, and any returned deliverables (rendered — PDF viewer, formatted brief, chart). One button: **"Ask a follow-up"** (opens the wizard pre-filled).

## What changes in code

**New routes (country-facing shell)**

- `src/routes/_authenticated/console.tsx` — layout with country-user chrome (masthead nav: *Study · Requests · Ministries · Account*). Renders `<Outlet />`. No chamber references.
- `src/routes/_authenticated/console.$code.index.tsx` — The Study (dashboard described above).
- `src/routes/_authenticated/console.$code.request.new.tsx` — the AI wizard (adapted from `concierge.new.tsx` with minister-lexicon copy and the 4-act flow above).
- `src/routes/_authenticated/console.$code.requests.index.tsx` — request list.
- `src/routes/_authenticated/console.$code.requests.$id.tsx` — request detail + deliverables.
- `src/routes/_authenticated/console.$code.ministries.tsx` — ministry list filter.

**New components (`src/components/console/`)**

- `ConsoleShell.tsx`, `StudyMasthead.tsx`, `AskPanel.tsx` (big primary CTA + AI-generated starter chips), `WaitingForYou.tsx`, `InFlightList.tsx`, `MinistryCards.tsx`, `BriefingStrip.tsx`, `RequestTimeline.tsx`, `DeliverableViewer.tsx`.

**Routing / gate changes**

- `src/routes/_authenticated/route.tsx` (or a small `beforeLoad` helper): after auth, resolve the user's role scope.
  - `admin` global → allow `/home` and `/admin/**`.
  - country-scoped user → redirect any hit on `/home`, `/admin/**`, or `/admin/countries/**` to `/console/$code`. Also redirects the raw chamber URLs (`/admin/countries/$code/ledger` etc.).
- `src/routes/_authenticated/home.tsx`: revert `CountryAdminWelcome` — it no longer renders `ChambersLauncher` or `ConciergeInvitationCard`. If a country user somehow lands here, redirect. Keep the super-admin multi-country and single-country agency views intact for global admins only.
- Super-admin impersonation continues to work: when `viewAs.code` is set, `/console/$code` is what the super admin sees, exactly as a country user would. The `ViewAsBanner` stays.

**Data**

The `service_requests`, `service_request_events`, `service_request_deliverables`, `service_request_drafts` tables already exist and are the correct backbone — I keep them. I add:
- `service_requests.ministry_id` (nullable) — the ministry the user routed the request to. Migration adds the column + FK + index; agency-side triage can still remap.
- `service_requests.outcome_kind` (text) — the plain-English outcome the user chose ("brief", "statement", "rehearsal", "comparison", "other"). Purely descriptive; the agency still decides which chambers to run.

RLS: country users see only their own requests and their country's deliverables; agency admins see the full queue. Grants included in the same migration per project rules.

**Copy / vocabulary lock**

I extend `minister-lexicon.ts` into a hard boundary: any string rendered under `/console/**` is checked against a banned list at review time (chamber names, "ledger", "scenario engine", "narrative chamber", "persona lab", "FDI studio", "cabinet room", stage numbers). The lexicon file becomes the single source of truth for how the agency's internal capabilities are described to country users.

**What I delete or move**

- `src/components/country/ChambersLauncher.tsx`, `ConciergeInvitationCard.tsx`, `CountryMasthead.tsx` — no longer used by country users. Kept only if the agency's country-detail admin view (`/admin/countries/$code`) uses them; otherwise removed.
- Any `<Link to="/admin/countries/$code/...">` referenced from a country-user surface is deleted.

## Acceptance — how we know it's fixed

1. Sign in as a country user for ATG (or as super-admin with "View as country user" on ATG). Land on `/console/ATG`. No chamber names, no chamber links, no `/admin/**` URLs visible in the DOM.
2. Type `/admin/countries/ATG/ledger` in the address bar as that same user → redirected to `/console/ATG`.
3. Click **Start a request** → 4-step wizard, no jargon; submitting creates a `service_requests` row and shows it in **In flight**.
4. Sign in as global admin → `/home` still shows the agency view with all seven chambers, the Concierge queue, and the fulfillment console — untouched.
5. Grep the `/console/**` route tree for the strings *chamber*, *ledger*, *scenario*, *narrative*, *persona lab*, *FDI*, *cabinet room* — zero hits outside comments.

## Order of work

1. Migration: add `ministry_id`, `outcome_kind` to `service_requests`; verify RLS + grants.
2. Console shell + `/console/$code` Study page reading real data (requests, deliverables, ministries).
3. AI-first wizard at `/console/$code/request/new` (port `concierge.new.tsx` logic, replace copy, add ministry step, drop chamber terminology).
4. Request list + detail + deliverable viewer.
5. Auth-gate redirect rules; retire chamber launcher from country home.
6. Lexicon guard + copy pass.
7. Manual walk-through of the acceptance list above.
