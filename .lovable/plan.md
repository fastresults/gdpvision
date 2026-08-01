## Goal

Once a commencement briefing exists, the super admin can press **Prepare presentation deck** and get a beautiful, on-brand slide deck that walks the client through the agency's order of process: **Brief → Programme → Participants → Instruments → Fieldwork → Evidence → Expected outcome**. The deck is presentable and printable inside GDPVision, and downloadable as a `.pptx`.

Note on the model: Claude isn't available through the platform's AI gateway. Deck copy will be written by the gateway default model (GPT-5.6) under a tight house-voice prompt, and the *design* is ours — a fixed GDPVision slide system (engraved-sketch marginalia, ink/paper/gold tokens, serif headings), not model-invented layout. That gives a more reliably on-brand result than any model-authored design.

## What gets built

### 1. Deck data model (new table `programme_decks`)

Stores a versioned deck per programme, alongside the briefing it was built from.

- `id`, `project_id`, `country_code`, `briefing_id`, `version`, `status` (`draft` | `shared`), `deck` (jsonb), `assembled_by`, `assembled_at`, `updated_at`
- Same GRANT + RLS shape as `programme_briefings` (authenticated read/write via `has_country_access`, service_role all).

Deck JSON shape (typed in `src/lib/personas/programme-deck.server.ts`):

```text
Deck
  title, subtitle, countryCode, programmeTitle, window, version
  slides: Slide[]
Slide
  id, kind, eyebrow, heading, subheading?
  bullets?: string[]           // ≤4, each ≤ ~14 words
  stats?: { label, value, note? }[]   // ≤3
  rows?: { left, right }[]     // for the process ladder / commitments table
  note?                        // one-line footer
  illustrationSlug?            // engraved sketch, marginalia only
Slide kinds: cover · orientation · stage (×5) · timeline · outcome · closing
```

### 2. Assembler — `assembleProgrammeDeck` server fn

`src/lib/personas/programme-deck.functions.ts` + `.server.ts`, mirroring the briefing assembler:

1. Loads the latest `programme_briefings` row (errors clearly if none — the button is only enabled when one exists).
2. **Deterministic spine**: cover, phase/window figures, the five stage slides, the milestone timeline, and the objective→instrument→deliverable commitment rows are computed straight from the briefing document's `metrics`, `window`, `readiness` and section content. No invented numbers, ever.
3. **AI pass** (gateway default model, `reasoningEffort: "none"`, structured output): given each briefing section, it writes the slide heading, ≤4 short bullets and the one-line note per slide, in the existing house voice used by the briefing narrative prompt. Length limits are stated in the prompt and clamped in code; a schema-failure falls back to deterministic bullets extracted from the briefing markdown so the deck never fails to build.
4. Inserts a new version row and returns it. `getProgrammeDeck` reads the latest.

### 3. Slide rendering — in-app deck (primary)

New route `/_authenticated/admin/countries/$code/personas/field/deck?project=…`, plus components under `src/components/personas/field/deck/`:

- `SlideCanvas.tsx` — fixed 1920×1080 slide scaled with `transform: scale(min(scaleX, scaleY))`, absolutely centred in an `overflow:hidden` frame. One component serves the editor view, thumbnails, presenter mode and print.
- `slide-type.css` block in the deck stylesheet defining `--slide-title / subtitle / body / caption / kicker / chrome` and matching semantic classes, so text is legible when projected (titles 88px, body 32px, chrome 20px). All colours come from existing `ink-*/paper-*/gold-*/line-*` tokens — no raw hex, no new colour names.
- Slide components per `kind`, all sharing one motif: thin gold rule + mono eyebrow, serif heading, generous margins, at most one engraved `<Illustration>` (`spot` / `mark` variant) as marginalia. Dark ink cover and closing slides, paper-light content slides in between.
- Deck chrome: thumbnail rail, ←/→ keyboard nav, `F5` fullscreen present mode, slide index in the URL.
- **Print / PDF**: `?print` mode stacks every slide one per page under `@page { size: 1920px 1080px landscape; margin: 0 }` with `break-after: page`, and the existing print-isolation pattern (`body * { visibility: hidden }` outside the print root) so the browser's Save-as-PDF yields a pixel-faithful handout.

### 4. `.pptx` export (secondary)

`pptxgenjs` added as a dependency and used **client-side** from the deck toolbar (no Worker/Node dependency): `src/lib/personas/deck-pptx.ts` maps the same deck JSON onto a 16:9 pptx with the GDPVision palette (ink navy/near-black, paper cream, gold accent), serif headings, 40–54pt titles and 20–24pt body, one layout per slide kind. Download is named `<Programme> — Commencement Deck v<N>.pptx`. Clearly labelled in the UI as the editable-but-simplified version; the in-app deck/PDF is the master.

### 5. Wiring into the briefing

In `BriefingPanel.tsx`, next to *Print* / *Export PDF* / *Mark as sent*:

- **Prepare presentation deck** — disabled until a briefing exists; shows `Preparing the deck…` while the assembler runs, then reveals **Open deck** (in-app) and **Download .pptx**.
- Re-running rebuilds from the current briefing as a new version; version + assembled date shown like the briefing does.
- The deck opens in the same modal shell already used for the briefing, so the field rail stays put, with Present / Print / Download .pptx in its header.

### Technical notes

- Assembler is a protected `createServerFn` (`requireSupabaseAuth`) called from the component via `useServerFn` + `useQuery`/`useMutation` — never from a route loader.
- Server-only helpers stay in `programme-deck.server.ts`, imported inside handlers; the gateway provider is created per request per the AI SDK gateway pattern, with 429/402 surfaced as readable errors in the UI.
- Docblock headers (`@domain / @tables / @ui`) added to the new `.functions.ts`, and `bun run headers && bun run map` run so the map-check CI stays green.
- New route registered by file creation only; `routeTree.gen.ts` untouched.
