# Op-ed landing pages

Public lead-generation surface at `/op-eds`, built entirely from the existing marketing design system.

## Decisions I'm making (you skipped the questions)

| Question | Decision |
|---|---|
| URL + nav | `/op-eds/$slug`, header link labelled **The writing**, placed between Sovereignty and Request briefing |
| Analytics | **First-party only.** UTMs, referrer and user agent land on the lead row; page views into our own table. No third-party script. |
| Email | **No provider.** The PDF opens instantly on submit; the "also sent to your inbox" line is omitted. |
| Assets | The op-ed markdown, emblems, figures and PDFs are **not in this repo or in your uploads**. I'll build the machinery and the full Chamber 04 page against a single `content.ts`, and generate the 8 emblems + 8 figures in the engraved house style. **The op-ed prose and the source strings I will not invent** — §14 forbids it. Each entry ships with an explicit `TODO` marker; a page with unresolved copy is excluded from the index and returns not-found until you paste the real text in. |

## What gets built

**1 · Data layer**

- Migration: `public.op_ed_requests` exactly as specified — GRANTs, RLS (no public select, service_role only), indexes on `created_at`, `slug`, `email`, all in one file.
- Private storage bucket `op-eds` for the PDFs; signed URLs, 60-minute TTL.
- `src/lib/op-eds/request.functions.ts` — zod validation mirroring `briefing.functions.ts`, honeypot returns silent success, admin client loaded with `await import(...)` inside the handler, header docblock present.
- `src/lib/op-eds/content.ts` — one array, the single source of truth for all eight pages (slug, chamber, accent token, title, standfirst, excerpt paragraphs, figure caption, sources, emblem, figure, pdf key, og image).
- `src/lib/chambers.ts` — extract the `CHAMBERS` array out of `MarketingHome.tsx` so the home page and the op-ed pages import one copy.

**2 · Routes**

```
src/routes/op-eds.index.tsx    reading room — 8 cards, campaign order, briefing CTA at foot
src/routes/op-eds.$slug.tsx    the landing page
```

Nine sections in the specified order: hero (emblem + hook + honest one-liner + CTA), ungated three-paragraph opening, the figure on a `--paper-100` band with the grade footnote, the four-field gate, the visible source list, the chamber bridge, the author note, and the other seven. The chamber's `--sector-*` accent runs as the page signature — hero rule, figure band edge, foot bar.

**3 · Conversion mechanics**

- Exactly four visible fields plus the hidden honeypot. Real `<label>`s, `aria-live` errors, keyboard-completable.
- Submit → row inserted → signed URL returned → the form block is **replaced in place**, scroll preserved. Button reads `Open the PDF`.
- The Cabinet-briefing cross-sell appears only in that post-submit state.
- No popup, sticky bar, chat widget or countdown anywhere.

**4 · Attribution**

UTMs read on mount, persisted to `sessionStorage`, submitted with the form alongside `document.referrer` and user agent. First-party event capture for `op_ed_view`, `op_ed_scroll_to_form`, `op_ed_submit`, `op_ed_pdf_open`, `op_ed_briefing_click`.

**5 · Artwork**

Eight emblems and eight figures generated in the canonical monochrome engraved-graphite style, rendered through `<Illustration>` per the illustration contract. Eight 1200×630 OG images derived from each hook. Served as WebP with PNG fallback, lazy-loaded below the fold.

**6 · SEO, performance, accessibility**

Per-page `head()` with unique title, description, canonical, `Article` JSON-LD, and the per-op-ed OG image. Only the hero image preloads. Headline verified fully visible at 390×844; contrast and heading order checked.

## Build order

1. Migration, bucket, server fn, `content.ts`, `chambers.ts` extraction
2. Chamber 04 page end to end, reviewed at phone width
3. Remaining seven from the same component
4. Index page + header nav
5. OG images, structured data, performance pass
6. Verify `bun run lint` and `bun run check:maps`

## What you need to supply before launch

- `op-eds/md/*.md` — the eight articles' frontmatter, first three paragraphs, and source lists (transcribed character-for-character; I will not paraphrase a citation)
- The eight PDFs, for upload to the private bucket
- If you'd rather I use your existing emblems and figures instead of newly generated ones, upload them and I'll swap the asset pointers

Do not start the LinkedIn campaign until step 6 is done — the first post is the cleanest read you'll ever get on which argument pulls, and it needs attribution live.
