## Goal
Let the user pick which channels (Press release, PM statement, X thread, LinkedIn, Cabinet memo, Radio 60s, Op-ed lede) to draft, then generate all selected ones sequentially with a single "Generate" click.

## UX changes — `src/components/narrative/DraftStudio.tsx`

1. **Channel selector row** (above the tab bar)
   - Small checkbox chip per channel: `☑ Press release  ☑ PM statement  ☐ X thread …`
   - Default selection = channels that already have a draft; if none, all seven selected.
   - "Select all" / "Clear" links on the right.
   - Selection persisted in `localStorage` per signalId so it survives navigation.

2. **Generate button behavior**
   - Label changes based on selection: `Generate (4)` / `Regenerate (2)` / disabled when 0 selected or strategy missing.
   - On click, run selected channels **sequentially** (not parallel — Perplexity rate limits and the current single-call pattern in `generateChannelDraft`).
   - Show inline progress under the button: `Writing 2 / 4 · X thread…` with a thin progress bar.
   - Each channel completed → invalidate `["narrative-artifacts", signalId]` so its tab dot updates live (amber = draft, green = released).
   - On failure of one channel, continue with the rest; collect errors and show a compact summary (`1 failed: LinkedIn — <msg>`, with Retry link that re-runs only the failed ones).

3. **Tabs**
   - Keep tab bar as-is for previewing/editing individual drafts.
   - Add a subtle checkbox on each tab label mirroring the selector so users can toggle from either place.
   - After batch completes, auto-switch to the first newly generated channel.

4. **Publish flow** — unchanged (per-channel, manual).

## No backend changes
`generateChannelDraft` already accepts `{ strategyId, signalId, channel }` and writes one artifact per call. Batch orchestration lives entirely in the client mutation so we get sequential progress, cancellation, and per-channel error handling for free.

## Technical notes
- Replace the single `genM` mutation with a `useMutation` whose `mutationFn` takes `channels: ChannelKey[]` and loops with `for…of await`.
- Track `progress: { done, total, current, errors[] }` in local state; reset on start.
- Add an AbortController wired to a "Stop" button that appears while running.
- No schema, RLS, or server-function edits required.
