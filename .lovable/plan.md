## Goal
Convert the 11 stage sections on `/admin/countries/:code/onboard` into a single-open accordion. All collapsed by default; opening one closes the others.

## Changes
File: `src/routes/_authenticated/admin/countries.$code.onboard.tsx`

1. **Add accordion state** in the parent component that renders the `StageCard` list:
   - `const [openStage, setOpenStage] = useState<string | null>(null);` (null = all collapsed by default).
   - Pass `isOpen={openStage === s.key}` and `onToggle={() => setOpenStage(openStage === s.key ? null : s.key)}` to each `StageCard`.

2. **Update `StageCard`** (`section` at line 344):
   - Accept `isOpen` and `onToggle` props.
   - Header row (title + `committed`/`draft` badge + `Run AI research` button) becomes a `<button>` toggling `onToggle`, with a chevron indicator that rotates when open.
   - Wrap the body (desc, last-run meta, draft preview, commit/run controls — everything below the header) in a container rendered only when `isOpen`.
   - Keep the `Run AI research` button clickable without toggling: place it outside the toggle button (flex row: toggle button on the left grows, action button on the right) and stop propagation.

3. **Behavior preserved**:
   - Auto-run loop, commit flow, badges, styling tokens, and the top "Run all pending" / stage chip summary all stay unchanged.
   - No route, data, or server-fn changes.

## Out of scope
Hero/marketing edits, styling overhaul, remembering open state across reloads, deep-linking to a stage via hash.
