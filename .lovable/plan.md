Shrink the kiosk top bar by 20% and scale its inner controls to match.

In `src/routes/index.tsx`:
- Grid rows: `8vh 92vh` → `6.4vh 93.6vh`.
- Top bar gap/padding: `gap-3 px-3` → `gap-2 px-2`.
- Category dropdown button: `h-10` → `h-8`, width `180` → `144`, dropdown menu width and `top` offset updated to match (`top: "6.4vh"`, width 144), icons `h-4 w-4` → `h-3.5 w-3.5`, text stays `text-sm`.
- Thumbnail strip tab buttons: height `h-[52px]` → `h-[42px]`, width `160` → `128`, padding `px-3` → `px-2`, text `text-sm` → `text-xs`.
- Admin link: `h-10` → `h-8`, padding `px-3` → `px-2`, keep `text-xs`.

No logic changes, no business-rule changes.