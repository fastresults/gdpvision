# Only-Active Citations + Source Popovers in Ask the Ledger

Today, `askTheLedger` returns every candidate source it retrieved (corpus chunks, country context anchors, web results) as `citations[]`, even when the model never references them. The inline `[N]` markers link out with a plain `target="_blank"` anchor, and the "Sources" list at the bottom includes every candidate — including entries with a title but no URL or with an empty title.

Two problems to fix:
1. Blank / unused citations appear under every answer.
2. There's no way to preview a source without leaving the page.

## Changes

### 1. Server — prune to only-active citations (`src/lib/ledger.functions.ts`)

After the model returns its `structured` answer (and before responding to the client):

- Collect every `[N]` marker across `situation`, `direct_answer`, `key_evidence[]`, `so_what[]`, and `caveats[]` (plus the plain-text fallback `answer` when structured parsing failed).
- Build the outgoing `citations[]` from that set only, in first-appearance order, and renumber sequentially (`1..k`).
- Rewrite every `[N]` in the answer text to the new numbering so markers and list stay in sync.
- Drop any citation that is empty (no `title` AND no `url` AND no `excerpt`) even if referenced — replace its marker with plain text.
- Recompute `sources_used = { corpus, country_context, web }` from the pruned set so the chip matches reality.

This applies uniformly whether the answer came from Tier 1 (corpus), Tier 2 (country context), or Tier 3 (deep research).

### 2. Client — source popover on every `[N]` (`src/components/ledger/AskTheLedger.tsx`)

Replace the current inline `<a>` in `renderCitations()` with the shadcn `Popover` primitive, wrapping a small button that shows `[N]`:

- **Trigger**: superscript `[N]` button (keyboard-focusable, `aria-label="Source N: <title>"`).
- **Content**: title, org, one-line source kind badge (Corpus / Country Context / Web), the excerpt (line-clamped to ~5 lines), and an "Open source ↗" link when a URL exists.
- Popover opens on click (works on touch) AND on keyboard focus; add a small `onMouseEnter` delay to also open on hover for desktop parity.
- If the citation has no URL, show the excerpt only and omit the outbound link.

The bottom "Sources" list keeps its current layout but now reflects the pruned set automatically. Each row also becomes a popover trigger (same content) so the user can preview without leaving the page.

### 3. Types

Extend `FigureCitation` in `src/lib/ledger.functions.ts` (already carries `title`, `url`, `org`, `excerpt`, `kind`) — no schema change, just make sure the pruning helper preserves `excerpt` and `kind` on the returned objects.

## Out of scope

- No database changes.
- No changes to how citations are gathered pre-answer (corpus/context/web retrieval logic stays as-is).
- Voice recorder, clear/copy/regenerate, and confidence chip are unchanged.

## Verification

1. Ask a question that produces a structured answer citing e.g. `[2]` and `[5]` out of 8 retrieved sources → the response and the "Sources" list show exactly 2 entries, renumbered `[1]` and `[2]`.
2. Ask a question where the model returns no `[N]` markers → citations array is empty; no "Sources" block renders.
3. Click and hover any `[N]` → popover shows title, org, kind badge, excerpt, and (when present) an outbound link.
4. Confirm no citation row appears with a blank title and no URL.
