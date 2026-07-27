# Op-ed content — read this before building the landing pages

Everything the `/op-eds` build needs is now in this repo. The full specification is
`docs/prd/PRD-op-ed-landing-pages.md`.

## Where things are

| What | Path | Notes |
|---|---|---|
| 8 op-eds | `content/op-eds/{NN}-{slug}.md` | YAML frontmatter + body. **Source of truth for all page copy** |
| 16 illustrations, vector | `public/op-eds/art/{NN}-{emblem,figure}.svg` | Prefer these on the web — line art, scales cleanly |
| 16 illustrations, raster | `public/op-eds/art/{NN}-{emblem,figure}.png` | Fallback / OG composition source |
| 8 PDFs | **not in the repo** — see below | |

## Frontmatter contract

```yaml
chamber: "04"                     # 01–08
chamber_name: The FDI Transition Studio
accent: "#a86a2f"                 # the chamber's --sector-* token
title: The date is set. The replacement is not.
standfirst: ...                   # one sentence, used as hero sub and meta description
byline: Adam Anderson
byline_role: OPEN Interactive
figure_caption: "The Gap — receipts falling faster than the replacement arrives."
figure_after_heading: 2           # PDF layout only; ignore on the web
sources:
  - "CBI receipts as share of government revenue, upper band — 50%, grade B. IMF Article IV consultations, 2022–2024. ..."
```

**Do not retype any of this into a component.** Parse the markdown, or generate
`src/lib/op-eds/content.ts` from it. Every source string must survive
character-for-character — em dashes, grade letters, and all. Paraphrasing a citation is
forbidden by §14 of the PRD.

The **ungated excerpt** is the paragraphs before the first `##` heading, capped at three.
That excerpt and the source list must both render *without* submitting the form — they are
the mechanism that makes the page convert, not a leak in it.

## The PDFs

The eight PDFs are deliberately **not** committed. Per the PRD they belong in a private
Supabase storage bucket, served as short-lived signed URLs after a lead is recorded, so the
download stays gated and 5MB of binaries stay out of git.

Bucket: `op-eds` (private, no public policy)
Keys:   `GDPVision-{NN}-{slug}.pdf`

Adam uploads them. Until the bucket is populated, build the pages against a placeholder and
leave the download button disabled rather than shipping a dead link.

## Illustration convention

These illustrations are the exception to `docs/illustration-contract.md` §3
("never commit the binary"). They were generated outside Lovable by a procedural pen-and-ink
renderer, so there is no `lovable-assets` pointer for them and no way to produce one from
inside the platform. The SVGs are text, and the PNGs are committed alongside so nothing has
to be regenerated.

They obey the house style in every other respect: monochrome, `--ink-950` on `--paper-0`,
crosshatch and stipple, no colour, no photography.

The figures already have their **citation and confidence grade drawn into the plate**. Do not
crop them. If a figure is lifted into a deck or a press page, its provenance travels with it —
that is the point.

## Regenerating

The renderer lives outside this repo, in the GDPVision working folder
(`op-eds/_build/art.py`, `build_pdf.py`, `verify.py`). If an illustration or a PDF needs
changing, it is regenerated there and re-committed here — not edited in place. The SVGs are
generated output.
