## Goal
When any accordion stage on `/admin/countries/:code/onboard` opens, the page scrolls so the very top of that stage's content (the header row + expanded body) is at the top of the viewport.

## Change (single file)
`src/routes/_authenticated/admin/countries.$code.onboard.tsx` — `StageCard`:

1. Add `const sectionRef = useRef<HTMLElement>(null)` and attach it to the outer `<section>`.
2. Add an effect:
   ```ts
   useEffect(() => {
     if (!isOpen) return;
     // Wait a frame so the expanded content has laid out, then scroll to the section top.
     requestAnimationFrame(() => {
       const el = sectionRef.current;
       if (!el) return;
       const y = el.getBoundingClientRect().top + window.scrollY - 8;
       window.scrollTo({ top: y, behavior: "smooth" });
     });
   }, [isOpen]);
   ```
3. Add `useRef`, `useEffect` to the existing `react` import.

## Why this shape
- Runs on every open transition (accordion is single-select, so switching stages also fires this).
- `getBoundingClientRect + scrollY` scrolls the window (the page's scroll container), not the section's own overflow, guaranteeing the stage header lands at the top.
- `requestAnimationFrame` ensures the newly rendered `{isOpen && ...}` body is in the layout before we measure, so no under-shoot.
- Small 8px offset keeps the top border visible.

## Out of scope
- The `<details>` toggles inside a stage (raw JSON, log) are not "accordions" per the user's wording — no change.
- No design/token changes; only behavior.

## Verification
Open the LCA onboard page, click each collapsed stage header — the stage's title row must snap to the top of the viewport every time, including when switching from one open stage to another.
