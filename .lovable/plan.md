## Goal

Strip the Ask page to the bare minimum. No headline, no subhead, no "Or start with one of these", no canned prompt cards. Just: a chat transcript (empty until they ask), a single always-visible input at the bottom, and the answers as they arrive.

## Changes — `src/routes/_authenticated/console.$code.ask.tsx`

**Remove:**
- The `<header>` block entirely (the "Ask the Second Brain" eyebrow, the "Quick, cited answers." headline, the paragraph, the "N answers in this conversation" line).
- The `showEmpty` block and the `canned` prompt array + card grid.
- The "Ask anything — indicator, ministry, sector…" placeholder copy on the collapsed pill; replace with nothing but a caret/thin placeholder.
- The `Sparkles` icon on the input pill (per chat UI guidance: never use Sparkles as agent identity). Keep just a subtle input row.

**Keep, unchanged:**
- All send / deep-research / expound logic and state.
- The composer sheet that opens when the user taps the input.
- The `TurnBlock` answer rendering.
- The thread menu (New conversation / Copy) — but move it to a tiny overflow button that appears only when there are turns, floating top-right of the transcript area (no header row anymore).

**New minimal layout:**
1. A flush transcript region that starts empty. When empty, nothing renders — pure paper background.
2. Turns list stacked as they come in.
3. The persistent bottom input bar stays, but simplified to one plain field: `Message` placeholder, no icon, no separate mic pill (mic stays inside the composer sheet only).
4. A single small "···" button pinned top-right (only when `turns.length > 0`) opens New conversation / Copy.

## Out of scope
- No changes to Study, Send flow, deep-research server logic, or tool-bar.
- No visual redesign of `TurnBlock`; it already renders bare answers.

## Files touched
- `src/routes/_authenticated/console.$code.ask.tsx` (only).
