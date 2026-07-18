## Add "Explain exposure" info icon → modal on the Exposure Ledger

### What the user sees
- A small discrete `Info` icon (lucide `Info`, 14px, ink-500) placed to the right of the "EXPOSURE LEDGER" eyebrow in the ledger header, next to the "what breaks" caption.
- Clicking it opens a centered `Dialog` (shadcn) titled **"How to read this exposure"** with a scrollable body (`max-h-[70vh] overflow-y-auto`).
- Body is a McKinsey-style briefing rendered in the existing serif/mono type system — ≤120 words total — covering:
  1. **What this is** — a per-sector delta between today's FDI mix and the resilient mix required by the framed threat.
  2. **How to read it** — `now %` (baseline share), `new %` (post-reallocation share), `Δ pp` (shift, red = contraction, green = growth), red bar = magnitude of forced retreat.
  3. **What "target" means** — sectors flagged by the threat brief as directly exposed; these carry the burden of reallocation.
  4. **What to do** — stage actions in the timeline that either de-risk targets (Δ negative) or absorb reallocated capital in beneficiaries (Δ positive).
- Footer: single "Got it" close button. Escape / overlay click also closes.

### Technical
- Edit only `src/components/studio/ExposureLedger.tsx`.
- Add `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`, `Button` from `@/components/ui/button`, and `Info` from `lucide-react`.
- Local `useState` for open state; icon is a `<button type="button">` with `aria-label="Explain exposure ledger"` — no new props required from parents.
- Keep the existing `ExplainHover` on the eyebrow (hover = short hint, click icon = full briefing) so we don't regress the 3.5s hover pattern.
- Copy lives inline in the component (single source, ≤120 words verified). No new files, no schema changes, no server work.

### Out of scope
- No changes to the Marimekko, Actions Rail, Staging Timeline, or Stress Test panels.
- No changes to `explain-copy.ts` (that registry is for hover cards, not long-form modals).
