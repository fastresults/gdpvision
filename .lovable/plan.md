## Sankey hover — dim non-hovered sections to 30% instead of near-invisible

**File:** `src/components/viz/SovereignSankey.tsx`

Currently, on hover, non-related flows drop to opacity `0.05` and non-related nodes drop to `0.22`, making them appear white/invisible. Change both to `0.30` so unrelated sections stay visible but clearly dimmed.

### Edits
- Line 239 (flows): `opacity={activeSet ? (on ? 0.88 : 0.05) : 0.42}` → `... : 0.30) : 0.42`
- Line 269 (input nodes): `opacity={active ? 1 : 0.22}` → `opacity={active ? 1 : 0.30}`
- Line 359 (output nodes): same change → `0.30`

Leave hover-related (`on` / `active`) opacities, transitions, and the central TREASURY node untouched.

### Verification
Hover a node in the sankey at `/admin/countries/AIA/viz`; unrelated flows and nodes should render at 30% opacity, not white.
