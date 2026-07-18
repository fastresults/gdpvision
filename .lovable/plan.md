## Goal
Every `[N]`, `[N][M]`, `[N,M]` marker rendered in the UI becomes a small superscript badge (e.g. ⁵). Hovering it opens a popover showing the actual source (title, org, URL, "Open ↗"). This applies globally — draft channels, strategy fields, dossiers, Ask-the-Ledger artifacts, scenario narratives, and PrettyJson-rendered payloads.

## Root cause of current gap
- `src/components/data/humanize.ts::splitCitations` already strips `[N]` markers but only surfaces them as a plain "refs: 5, 7, 8" line in `PrettyJson`.
- Markdown bodies in `DraftStudio`, `StrategyPanel`, `ArtifactPanel`, and `NarrativePanel` render `[N]` verbatim into text with no lookup and no hover.
- Artifacts already carry a `citations: string[]` array (see `narrative-chamber.functions.ts` lines 167/200/255/347 and `narrative.functions.ts:489`); the UI just never binds it to the markers.

## Plan

### 1. New shared primitive
Add `src/components/citations/CitationSup.tsx`:
- Props: `n: number`, `citation?: { url?: string; title?: string; org?: string; label?: string }`.
- Renders a `<sup>` containing a small Radix `HoverCard` trigger styled as `bg-ink-100 text-ink-800 rounded-sm px-[3px] font-mono text-[10px]`. Superscript unicode is not used — a real `<sup>` element keeps accessibility.
- HoverCard content (openDelay ~150ms): org + title, truncated URL, and an "Open source ↗" link (`target=_blank rel=noopener`). Falls back to "Source N" when metadata is missing.
- Keyboard: focusable button; Enter/Space opens; Escape closes.

Add `src/components/citations/CitedText.tsx`:
- Props: `text: string`, `citations: Array<{url,title?,org?}>`, optional `className`.
- Tokenizes the string with the same regex family as `splitCitations` but preserves the marker positions, emitting `<CitationSup>` for each ref.
- Also linkifies bare URLs via existing `linkifyParts` so behavior stays consistent.

Add `src/components/citations/CitedMarkdown.tsx`:
- Wraps `ReactMarkdown` + `remark-gfm` and passes a `components` map where `p`, `li`, `td`, `th`, `strong`, `em` recurse over children and route any string child through `CitedText`. This intercepts markers wherever they appear in prose, lists, or tables without pre-processing the markdown string (avoids breaking code blocks).
- Accepts the same `citations` array. When absent, degrades to plain `ReactMarkdown` (no crash, no dead numbers rendered — markers still show but as plain text; we log a dev warning to help spot missing wiring).

### 2. Wire the primitive at every render site
| File | Change |
|---|---|
| `src/components/narrative/DraftStudio.tsx` (line 300) | Replace `<ReactMarkdown>{body}</ReactMarkdown>` with `<CitedMarkdown source={body} citations={draft.citations ?? strategy.citations ?? []} />`. Pull citations from the draft record; server already stores them. |
| `src/components/narrative/StrategyPanel.tsx` (lines 71, 81, 92) | Replace `{String(seven[k] ?? "—")}` and talking-points / risks list items with `<CitedText text={...} citations={strat.data.citations ?? []} />`. |
| `src/routes/_authenticated/narrative/signal.$id.tsx` (line 54) | Wrap `d.signal.summary` in `<CitedText text={...} citations={d.signal.citations ?? []} />` (add `citations` to the dossier payload). |
| `src/components/ledger/ArtifactPanel.tsx` (line 155) | Swap `ReactMarkdown` for `CitedMarkdown`, passing the artifact's `citations`. |
| `src/components/scenarios/NarrativePanel.tsx` | Same swap; pass `mut.data.citations ?? []`. |
| `src/components/studio/ReadMore.tsx` | Same swap when a `citations` prop is supplied. |
| `src/components/data/PrettyJson.tsx` | Update the value renderer at line 179: instead of stripping refs and printing "refs: …", render inline `<CitationSup>` chips using the `citations` array already threaded through `PrettyJson` props (already documented in Core memory). Also remove the trailing "refs:" tail so behavior matches the rest of the app. |

### 3. Data-side confirmations (no schema changes)
- `citations` already exists on `narrative_strategies`, `narrative_drafts`, `narrative_signals` (via jsonb), and scenario/artifact rows — verified in `narrative-chamber.functions.ts` and `narrative.functions.ts:489`.
- `getDossier` needs to include `signal.citations` in its select — one-line addition; no migration.
- Server writers already store `citations` as `string[]` of URLs. `CitationSup` derives a display title lazily from URL host until server enrichment lands; a follow-up (out of scope) can enrich with `{title, org}`.

### 4. Guardrail
Add ESLint `no-restricted-syntax` rule forbidding `ReactMarkdown` imported directly under `src/components/**` and `src/routes/**` except from `src/components/citations/CitedMarkdown.tsx`. Enforces global usage the same way `PrettyJson` is enforced today.

### 5. Verification
- Reload `/admin/countries/ATG/narrative/signal/9797…` and confirm `[5][7][8]` in the food-import section renders as three separate superscript chips with working hover popovers linking to the stored URLs.
- Check Ask-the-Ledger findings, a scenario narrative, and a PrettyJson block for the same behavior.
- Run `bun run build` (typecheck + Vite) and `bunx eslint .` — the new rule should pass because every render site was migrated.
