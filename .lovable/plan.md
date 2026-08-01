## What's happening

Your screenshot shows the Commencement Briefing losing its right margin: body lines, table cells and even the running "12 / 14" page number run off the right edge of the sheet.

The three portrait printables all declare their print root the same way:

```css
#briefing-print-root   { position: absolute; inset: 0; width: 100%; }  /* PrintableBriefing.tsx */
#plan-print-root       { position: absolute; inset: 0; width: 100%; }  /* PrintablePlan.tsx */
#value-case-print-root { position: absolute; inset: 0; width: 100%; }  /* PrintableValueCase.tsx */
```

An absolutely positioned element is sized against the **initial containing block**, not the page content box. When printing, that is the document viewport — roughly the browser window width (~1500px here), not the ~184mm Letter text column. So the content is laid out at window width and then hard-clipped at the paper edge. The wider the window when you hit print, the more is lost — which is why it looks intermittent.

The presentation deck does not suffer this: it declares an explicit `width: 1920px` that matches its sheet exactly (fixed last turn).

## The fix

Let the print roots participate in normal flow, so the page content box defines their width and the paginator can fragment them across pages.

1. **`src/components/personas/field/briefing/PrintableBriefing.tsx`** — replace the absolute block on `#briefing-print-root` with static flow: `position: static; width: auto; margin: 0;`. Keep font, colour and size rules unchanged.
2. **`src/components/mandate-compact/plan/PrintablePlan.tsx`** — same change on `#plan-print-root`.
3. **`src/components/calculator/PrintableValueCase.tsx`** — same change on `#value-case-print-root`.
4. **Cover pages** — the briefing cover uses `padding: 22mm 18mm` *inside* a page that already has `margin: 0` on `@page :first`, so it stays full-bleed; the non-cover pages inherit the `@page` margin box and no longer need any root-level inset. Verify no double-margin appears on page 1 after the change.
5. **Bleed guard** — add a defensive `#…-print-root, #…-print-root * { max-width: 100%; }`-style rule for tables and long unbroken strings, plus `table-layout: fixed` on the wide risk/mitigation tables so a long mitigation sentence wraps rather than pushing the table wider than the column.

## Verification (not optional)

Render the real GRD briefing through headless print-to-PDF, then convert **every** page to an image and inspect:

- page width is 8.5in × 11in portrait, symmetric left/right margins;
- no line, table cell or running footer touches or crosses the right trim;
- the running header/footer margin boxes sit where intended and the page counter is complete;
- cover page 1 is full-bleed with no stray margin, and page count matches the on-screen document.

Repeat the same PDF pass for the Mandate Compact plan and the Value Case, since they carry the identical defect. Re-run the deck export once as a regression check.

## Technical note

No layout or content changes to any on-screen UI — the edits are confined to the `@media print` blocks of the three printable components. `PrintSurface` and the global print rules in `src/styles.css` stay as they are.
