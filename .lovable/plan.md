## What's wrong

Section 01 currently renders three things stacked as plain paragraphs:

1. `plan.summary` (this part is fine — the lede reads well).
2. A verbatim quotation of the client PDF text, produced by `briefQuotation()` in `src/lib/personas/commencement-briefing.server.ts`. The filter only removes cover furniture that appears at the *start of a line*, so it lets through the client proposal's own contents list, address block, contact details and stray fragments — "n = 400+ ±5%", "2026", "Survey Research &", "1st Floor, Galleria Mall…", "Executive Summary", "Project Team", "Financial Proposal — Track One". Each fragment becomes its own paragraph, producing the ladder of one-line stubs in the screenshot.
3. The objectives table.

So it is both a content problem (wrong text survives the filter) and a layout problem (nothing but full-width body paragraphs).

## The fix

### 1. Stop quoting the raw PDF; extract from it

Replace the "quote a slab of the brief" approach with two derived blocks:

- **Key parameters strip** — parse the committed brief for the handful of facts a client wants confirmed back: sample size and margin of error, fieldwork window, audiences, deadline/decision date, methods. Rendered as a bordered grid of label/value cells (same visual family as the cover metrics), not prose.
- **A real quotation** — keep at most 2–3 *sentences* of the client's own ask. Tighten `briefQuotation()` so a paragraph only survives if it is a running sentence: ≥ 12 words, contains a lowercase verb-bearing clause, and ends in terminal punctuation. Anything shorter (headings, list items, addresses, emails, URLs, bare years, figures) is dropped rather than emitted as its own paragraph. If nothing qualifies, omit the quote block entirely rather than printing debris.

### 2. Give the section a production-grade layout

Section 01 gets its own structured renderer rather than generic markdown prose:

```text
AS WE UNDERSTOOD IT
01  The brief

┌──────────────────────────────────────────────┐
│  lede paragraph — larger, 60ch measure       │
└──────────────────────────────────────────────┘

SAMPLE      MARGIN     WINDOW        DECIDES BY     AUDIENCES
400+        ±5%        Aug–Oct 26    24 Oct 2026    Citizens, Diaspora, Agents

┌ ▌ In the client's words ────────────────────┐
│  "…two or three real sentences…"            │
└─────────────────────────────────────────────┘

WHAT COUNTS AS AN ANSWER
01 │ Objective ................ Why it matters
02 │ …
```

- Lede set at ~13pt with a constrained measure so it doesn't run the full page width.
- Parameters strip: uppercase mono labels, tabular-nums values, hairline dividers.
- Quotation: gold left rule, indented, italic, capped height.
- Objectives keep the existing table styling but with numbered gold row markers.

### 3. Apply everywhere the dossier renders

Same structure must hold in the on-screen panel, the print/PDF surface, and the public `/d/$token` share view — all three already consume the same `PrintableBriefing`, so the change lands once. Verify no overflow in landscape print and no clipped right margin.

## Technical notes

- `src/lib/personas/commencement-briefing.server.ts` — tighten `briefQuotation()`; add a `briefFacts()` extractor; emit section 01 with a structured `facts` payload alongside `body_md` (additive field on `BriefingSection`, existing sections unaffected).
- `src/components/personas/field/briefing/PrintableBriefing.tsx` — render section 01 through a dedicated `BriefOpener` block; add `.cb-lede`, `.cb-facts`, `.cb-quote` rules to the print stylesheet.
- No schema change. Existing briefings will re-render correctly on regeneration via the existing "Re-compose" control; stored older documents fall back to the current markdown path.
