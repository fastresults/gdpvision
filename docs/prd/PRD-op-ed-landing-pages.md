# PRD · Op-ed landing pages

**Product:** GDPVision (gdpvision.com)
**Surface:** new public routes — `/op-eds` index and `/op-eds/$slug` × 8
**Goal:** lead generation and inbound traffic
**Type:** new build. Reuses the existing marketing design system, form pattern, and server-fn conventions.
**Date:** 27 July 2026

---

## 0 · How to use this document

Written for Lovable.dev to implement directly. Order of sections is roughly build order. Literal
copy in fenced `COPY` blocks ships verbatim. Anything marked `[ADAM TO CONFIRM]` must not ship until
confirmed — leave the element out rather than guessing.

**The single most important instruction:** this page is being read by a Permanent Secretary or a
Chief of Staff to a head of government. Every conventional lead-gen device — the exit popup, the
countdown, "Download your FREE guide!", the 9-field form, the chat bubble — will lose this reader
permanently. Conversion here comes from evidence and restraint, not urgency theatre. If a pattern
would look out of place in a central bank annual report, it does not belong on this page.

---

## 1 · Context

### What already exists

Eight op-eds are written, illustrated, and rendered as PDFs. Each is ~1,000 words, bylined **Adam
Anderson, OPEN Interactive**, and maps 1:1 to a GDPVision chamber.

| # | Slug | Chamber | Accent | Title | Sources |
|---|---|---|---|---|---|
| 01 | `national-ledger` | The National Ledger | `#1e3350` | Governing from a photograph. | 1 |
| 02 | `portfolio-workspaces` | Portfolio Workspaces | `#b98a2f` | Ask a minister what their portfolio contributes. | 2 |
| 03 | `scenario-engine` | The Scenario Engine | `#5b4fa8` | Two hundred and twenty-six per cent, in a single night. | 3 |
| 04 | `fdi-transition-studio` | The FDI Transition Studio | `#a86a2f` | The date is set. The replacement is not. | 2 |
| 05 | `narrative-chamber` | The Narrative Chamber | `#8e2f3c` | Zero seats. | 3 |
| 06 | `cabinet-room` | The Cabinet Room | `#7a4a6b` | What happened to the decision? | 2 |
| 07 | `persona-lab` | Persona Lab | `#6f8a3a` | We are exporting the people we need, and guessing at how to keep them. | 3 |
| 08 | `mandate-compact` | The Mandate Compact | `#2e7d5b` | Someone will grade your manifesto. It should be you. | 2 |

Accents are the `--sector-*` tokens each chamber is already assigned in `MarketingHome.tsx`. Use the
token, not the hex.

Each op-ed has, already built and ready to ingest:

- a 6–7 page A4 PDF (cover, article, sources-and-grades page, briefing CTA)
- an **emblem** — a pen-and-ink object drawn in the manner of a woodcut
- a **figure** — the article's own argument drawn as a diagram, with its source and confidence
  grade printed inside the plate
- frontmatter carrying title, standfirst, chamber, accent token, figure caption, and the full
  source list

Delivery assets live outside the repo in the GDPVision working folder. See §11 for ingestion.

### Where the traffic comes from

A LinkedIn campaign, posted from Adam's personal profile, one op-ed per week over eight weeks in the
order **04 → 08 → 03 → 01 → 05 → 06 → 02 → 07**. Each post is a three-slide carousel using the same
emblem and figure that appear on the landing page, and ends with a tracked link.

**This matters for the build.** A visitor arriving from that post has already seen the emblem, the
figure, and the opening argument. The landing page must feel like the *same object continued*, not a
different pitch. Continuity is the conversion mechanism: the reader recognises the page, which reads
as consistency rather than marketing.

### Who is reading

Primarily one of four people, in a small island developing state, usually on a phone:

1. **A Permanent Secretary or Chief of Staff** — deciding whether this is worth their principal's
   attention. The most common and most valuable visitor.
2. **A minister or head of government** — rare, brief, and the reason the whole thing exists.
3. **A technical official** — Ministry of Finance, central bank, statistics office. Will check the
   sources. Will be lost instantly by an unsourced number.
4. **A regional adviser, journalist, or multilateral staffer** — not a lead, but shares things.
   Optimise for them at zero cost by making the page pleasant to link to.

What is true of all of them: they are habitually condescended to by vendors and multilaterals, they
are short of time, and they will not exchange contact details for something that looks like
marketing. They will exchange them for a document that is visibly serious.

---

## 2 · Objectives

**Primary.** Capture qualified leads — a named person, their role, their government, an official
email — in exchange for a document worth reading.

**Secondary.** Inbound traffic and linkability. These pages should be the thing a regional
journalist cites and a policy adviser forwards.

**Tertiary.** Warm the briefing funnel. Some readers will skip the download and go straight to
*Request a Cabinet briefing*. That is a better outcome, not a leak, and the page must make it
available without pushing.

### Success metrics

| Metric | Definition | Note |
|---|---|---|
| **Download conversion** | form completions ÷ unique page views | The headline number. Segment by `utm_content` so the eight are comparable |
| **Qualified rate** | completions with a government/official email ÷ all completions | The number that actually matters. A hundred students is worth less than four Permanent Secretaries |
| **Briefing conversion** | briefing requests attributed to an op-ed page | The highest-value event on the site |
| **Scroll-to-form** | reached the form section ÷ page views | Diagnoses hook failure vs. form failure |
| **Per-op-ed pull** | conversion by chamber | Tells us which argument sells. Feeds sales strategy, not just marketing |

Do not set a conversion target before there is a baseline. Publish the eight and read the spread.

---

## 3 · The conversion argument

Read this before building. Every layout decision below follows from it.

A visitor gives up their identity when three things are true at once:

**1 · The problem is theirs, stated better than they would state it.** The hook is not "download our
whitepaper." It is the sentence that makes a Permanent Secretary think *someone has actually sat in
that room*. We have those sentences already — they are the op-ed openings, and they are the best
asset in this project.

**2 · The document is visibly real before they pay for it.** This is the mechanism most gated
downloads get wrong. They describe the document. We will **show its actual figure**, at full size,
with its source and confidence grade printed on the plate, plus a genuine excerpt. The reader can
verify quality before deciding. Counter-intuitively, giving more away raises conversion here,
because the doubt being resolved is "is this substantive or is it a brochure?"

**3 · The ask is small, dignified, and instantly honoured.** Four fields. No phone number. No
"company size." No newsletter checkbox pre-ticked. And the document arrives **immediately on
submit** — not "check your inbox."

Against that, the things that will destroy conversion with this specific reader:

- Any exit-intent popup, sticky bar, or chat widget.
- Fake scarcity — "limited copies", countdowns, "247 downloads this week."
- The word "free" more than once. Once is reassurance; twice is a car lot.
- Any unsourced statistic anywhere on the page.
- A form that asks for anything we do not need.
- Stock photography of any kind. We have hand-drawn illustration; using a photo of a boardroom
  would undo it.

---

## 4 · Routes and information architecture

```
/op-eds                     index — all eight, ordered by campaign priority
/op-eds/$slug               the landing page (8 of these)
/op-eds/$slug/thank-you     post-submit state  (see §8 — may be inline instead)
/api/op-ed-pdf              authenticated-by-token PDF stream
```

TanStack Start file-based routing, matching existing conventions:

```
src/routes/op-eds.index.tsx
src/routes/op-eds.$slug.tsx
src/routes/op-eds.api.pdf.ts
```

Add `The writing` (or `Op-eds`) to the marketing header nav in `MarketingShell.tsx`, between
`Sovereignty` and `Request briefing`. This is also the fix for a live problem: the site currently has
no reason to return to, and no page a search engine can rank for a policy query.

---

## 5 · Page anatomy — `/op-eds/$slug`

Nine sections, in this order. Section 1 and 4 do almost all of the conversion work.

### 5.1 · Hero — the hook

Full-width, `--paper-0`, generous. Two columns on desktop (copy left, emblem right), stacked on
mobile with the emblem *above* the headline.

```COPY
eyebrow:    OP-ED · CHAMBER {NN}
headline:   {op-ed title, serif, large}
standfirst: {op-ed standfirst}
byline:     ADAM ANDERSON · OPEN INTERACTIVE
```

Below the standfirst, a single mono line — the honest description of what is on offer:

```COPY
1,000 words  ·  {N} sourced figures, each with its confidence grade  ·  PDF
```

Then the primary CTA button, and immediately beneath it, in small type:

```COPY
Read the opening below before deciding.
```

That line is doing real work. It tells a sceptical reader they are not about to be walled off, which
is exactly what makes them keep scrolling instead of leaving.

**Mobile rule:** the headline must be fully visible above the fold on a 390 × 844 viewport. If a
title cannot fit at the display size, reduce the size — never truncate.

### 5.2 · The opening — ungated excerpt

**The most important section on the page after the hero.** Render the **first three paragraphs of
the actual op-ed**, in the document's own typography, at reading size (17–19px, serif, generous
leading, measure capped at ~68 characters).

Then a soft fade or a hairline rule, and:

```COPY
The article continues for a further 800 words.
```

Do not use a hard truncation mid-sentence. Break at a paragraph. The excerpt must end at a point
that creates a question — for most of these the third paragraph does this naturally, because the
op-eds were written to earn the next paragraph.

**Implementation:** parse from the op-ed markdown rather than duplicating copy. Excerpt = paragraphs
up to the first `##` heading, capped at three.

### 5.3 · The figure — proof of substance

Full measure, `--paper-100` band, the article's own diagram with its caption beneath.

```COPY
eyebrow:  FROM THE ARTICLE
caption:  {figure_caption}
footnote: Every figure in this article carries its source and its confidence grade.
          A grade is not a claim of accuracy — it is a statement of how much weight
          a number will bear. We publish ours because we ask governments to do the same.
```

The figure image already has the citation and grade drawn into it. Do not crop them out. That
footnote paragraph is the strongest trust signal available on the page and it doubles as an
argument for the National Ledger.

### 5.4 · The gate — form

Immediately after the figure, while the reader is convinced. Do **not** put it at the very bottom.

```COPY
eyebrow:  CONTINUE READING
heading:  Read the full op-ed.
lede:     Four fields. The PDF opens immediately — nothing to wait for in your inbox.
```

Fields, in this order, and no others:

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | |
| Role or title | text | yes | placeholder: `e.g. Permanent Secretary` |
| Government or organisation | text | yes | placeholder: `e.g. Ministry of Finance` |
| Official email | email | yes | |
| `website` | text | — | **honeypot**, visually hidden, must stay empty |

No nation dropdown here. The briefing form gates on the CARICOM registry because a briefing is a
serious commitment; a download is not, and every additional field costs completions. Nation can be
inferred later from the organisation and the email domain.

Beneath the submit button:

```COPY
We will not add you to a mailing list. OPEN Interactive may write to you once,
from a named person. Nothing about your enquiry is shared outside OPEN Interactive.
```

That promise must be true. If a newsletter is planned later, this line changes first.

**Submit button label:** `Open the PDF` — not "Submit", not "Download now". It describes exactly
what is about to happen.

### 5.5 · Post-submit — inline replacement

Replace the form block in place, preserving scroll position. Do not navigate away; a page change
loses the reader's context and looks like a funnel.

```COPY
heading:  Here it is.
button:   Open the PDF  →
line:     Also sent to {email} so you can forward it.        [ADAM TO CONFIRM — only if email is wired]
```

Then, and only here, the cross-sell:

```COPY
If it is useful and you would like the argument applied to your own numbers,
OPEN Interactive delivers confidential Cabinet briefings — sixty minutes, no
slideware, under NDA on request.

→ Request a Cabinet briefing
```

Placing the briefing ask *after* the download rather than instead of it is deliberate. The reader has
just received something; reciprocity is at its highest point in the whole session.

### 5.6 · Sources — visible before the gate

Do not hide the source list behind the form. Render it on the page:

```COPY
eyebrow: SOURCES AND CONFIDENCE GRADES
```

Then each source verbatim from frontmatter, in mono, small. A technical official will read this and
nothing else. Making it public costs nothing and converts exactly the person who most needs
convincing.

### 5.7 · The chamber — the product bridge

One short band. The op-ed argues a problem; this names the instrument, briefly, without turning the
page into a pitch.

```COPY
eyebrow: THE INSTRUMENT
heading: {chamber_name}
body:    {chamber purpose line from MarketingHome CHAMBERS[]}
bullets: {the chamber's three existing bullets}
close:   The chamber drafts. Principals decide. Nothing releases autonomously.
link:    See all eight chambers →   (to /#instrument)
```

Reuse the existing `CHAMBERS` data in `MarketingHome.tsx` — do not retype it. Consider extracting it
to `src/lib/chambers.ts` so both surfaces import one source.

### 5.8 · The author

Short. Credibility, not biography.

```COPY
ADAM ANDERSON · OPEN INTERACTIVE

OPEN Interactive originated the Caribbean Investment Summit franchise in 2009,
delivered national digital infrastructure for the Government of St. Kitts & Nevis,
and has maintained head-of-government relationships across the OECS for seventeen
years. GDPVision is built by the people already in the room.
```

### 5.9 · The other seven

Cards linking to the remaining op-eds — emblem, chamber number, title, one line. This is the traffic
and dwell-time engine: a reader who came for the CBI cliff frequently also has a manifesto problem.

Order by campaign priority (04, 08, 03, 01, 05, 06, 02, 07), excluding the current one.

---

## 6 · Per-op-ed content

**All page content derives from the op-ed frontmatter.** Do not retype copy into components.

Create `src/lib/op-eds/content.ts` exporting one array. Fields per entry:

```ts
{
  slug: string;            // "fdi-transition-studio"
  chamber: string;         // "04"
  chamberName: string;     // "The FDI Transition Studio"
  accent: string;          // "#a86a2f"  — the --sector-* token
  title: string;
  standfirst: string;
  excerpt: string[];       // first three paragraphs, verbatim
  figureCaption: string;
  sources: string[];       // verbatim, each ending "grade X. <citation>"
  emblem: string;          // /op-eds/art/04-emblem.png
  figure: string;          // /op-eds/art/04-figure.png
  pdf: string;             // storage key
  ogImage: string;         // /op-eds/og/04.jpg
}
```

Frontmatter for all eight is in the GDPVision working folder at `op-eds/md/*.md`. Transcribe
exactly — every source string must survive character-for-character, including the em dashes and the
grade letters, because §14 forbids paraphrasing a citation.

### The eight hooks, for reference

These are the headlines. They are already written and tested against the argument; do not rewrite
them for SEO or for punchiness.

| # | Hook |
|---|---|
| 01 | Governing from a photograph. |
| 02 | Ask a minister what their portfolio contributes. |
| 03 | Two hundred and twenty-six per cent, in a single night. |
| 04 | The date is set. The replacement is not. |
| 05 | Zero seats. |
| 06 | What happened to the decision? |
| 07 | We are exporting the people we need, and guessing at how to keep them. |
| 08 | Someone will grade your manifesto. It should be you. |

---

## 7 · Index page — `/op-eds`

A reading room, not a resource library.

```COPY
eyebrow: The writing
title:   Eight arguments about governing a small state.
lede:    Written for Presidents, Prime Ministers and Cabinets. Each is about a thousand
         words, each figure carries its source and its confidence grade, and each is
         free to read.
```

Then eight cards — emblem, chamber number, title, standfirst, `Read →`. Campaign order.

Close the page with the briefing CTA, using the existing `BriefingForm` component rather than a new
one.

This route is also the SEO surface. It should rank for regional policy queries, which is why the
excerpts and sources are ungated.

---

## 8 · Delivery

**Recommendation: instant in-browser access, with the lead recorded server-side.**

There is currently no email provider in the codebase — no Resend, SendGrid, or SMTP configuration
anywhere in `src/` or `supabase/`. So "we'll email it to you" cannot be built today without adding a
dependency, and it would also cost conversions and introduce deliverability risk into the exact
moment the reader is deciding whether we are competent.

Flow:

1. Form submits to `submitOpEdRequest` server fn.
2. Handler validates, honeypot-checks, inserts a `op_ed_requests` row, and returns a **short-lived
   signed URL** to the PDF in Supabase storage (TTL 60 minutes).
3. Client swaps the form for the success state, with the signed URL on the button.
4. Adam follows up personally from the CRM view of that table.

**Note for the campaign copy:** `op-eds/SOCIAL-LAUNCH.md` and the archive currently say the PDF is
delivered by email. If this recommendation is adopted, that line needs changing in both places.

**[ADAM TO CONFIRM]** whether to add an email provider in a later phase. If yes, keep the instant
download regardless and treat email as a copy, not as the delivery mechanism.

---

## 9 · Data model

Mirror `briefing_requests` exactly — same shape, same conventions, same discipline.

```sql
CREATE TABLE public.op_ed_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  slug         text NOT NULL,
  chamber      text NOT NULL,
  name         text NOT NULL,
  role         text NOT NULL,
  organisation text NOT NULL,
  email        text NOT NULL,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  referrer     text,
  user_agent   text,
  status       text NOT NULL DEFAULT 'new'
);
```

Per the repo's cardinal rules: **GRANTs and RLS policies must be in the same migration as the
`CREATE TABLE`.** No public select. Insert happens through the admin client inside the server fn,
never from the browser. Index on `created_at`, `slug`, and `email`.

Server fn goes in `src/lib/op-eds/request.functions.ts` with the required header docblock:

```ts
// @domain marketing
// @tables op_ed_requests
// @ui src/routes/op-eds.$slug.tsx
```

Validate with zod, mirroring `briefing.functions.ts`: trimmed strings, max lengths, real email,
honeypot returns a silent success. Load the admin client with `await import(...)` inside the
handler — never at module scope.

Run `bun run headers && bun run map` before committing or `map-check` CI will reject the PR.

---

## 10 · Attribution and analytics

**Capture UTMs into the lead row.** The campaign tags every link
`?utm_source=linkedin&utm_medium=social&utm_campaign=op-eds&utm_content=ch04`. Read them on mount,
persist to `sessionStorage`, and submit them with the form. Without this the whole
which-argument-pulls question is unanswerable, and that question is worth more than the leads.

Also capture `document.referrer` and user agent.

**Events**, if any analytics is added: `op_ed_view`, `op_ed_scroll_to_form`, `op_ed_submit`,
`op_ed_pdf_open`, `op_ed_briefing_click` — each with `slug` and `utm_content`.

**Constraint from the sovereignty commitment:** the site states *"no third-party analytics or
trackers inside government instances."* That applies to deployed instances rather than the marketing
site, but the spirit should hold here too. Prefer first-party event capture into Supabase over
loading a third-party script. If a third party is used, it must not run on authenticated routes.
**[ADAM TO CONFIRM]** the analytics decision.

---

## 11 · Asset ingestion

Assets are built and live outside the repo, in the GDPVision working folder:

| Source | Destination | Notes |
|---|---|---|
| `op-eds/art/{NN}-emblem.png` | `public/op-eds/art/` | 1380 × 1080, transparent-safe on paper |
| `op-eds/art/{NN}-figure.png` | `public/op-eds/art/` | 2160 × 1140 |
| `op-eds/pdf/GDPVision-{NN}-{slug}.pdf` | Supabase storage bucket `op-eds` | private; signed URLs only |
| `op-eds/md/*.md` | source for `content.ts` | frontmatter + first three paragraphs |

Also required: **eight OG images**, 1200 × 630. Build these from the existing poster slides rather
than commissioning new art — the hook slide crops to that ratio cleanly. Without per-op-ed OG
images, every LinkedIn share of these pages looks identical, which wastes the campaign's best
organic channel.

Serve images as WebP with PNG fallback. The emblems are line art and compress extremely well.

---

## 12 · Design system

Everything comes from `src/styles.css`. No new tokens, no new colours.

- Surface `--paper-0`; alternate bands `--paper-100`; hairlines `--line-200`
- Type `--ink-950` display, `--ink-700` body, `--ink-500` metadata, `--ink-300` citations
- `--gold-500` for eyebrow rules and section marks
- The chamber's own `--sector-*` accent as a page signature: the hero rule, the figure band edge,
  and a full-width bar at the page foot — exactly as the PDF and the social slides do it
- Buttons use `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-accent`. **Never** inline
  `bg-ink-* text-paper-*` on a `<button>` or `<a>` — ESLint will reject it
- Serif for display and article text; mono for metadata, eyebrows, and sources; sans for UI

Reuse `SectionHeader`, `MarketingShell`, and the `BriefingForm` styling language. This should look
like the same hand made the home page, the PDF, and this.

---

## 13 · SEO, performance, accessibility

**SEO.** Unique `<title>` and meta description per page, built from title and standfirst. Canonical
URLs. `Article` structured data with `author`, `datePublished`, and `about`. The ungated excerpt and
the visible sources are what make these pages rankable — do not gate them for "conversion reasons."

**Performance.** These readers are on regional mobile networks, sometimes poor ones. LCP under 2.5s
on a 4G throttle is a requirement, not an aspiration. The hero must not wait on the emblem: inline
critical CSS, lazy-load everything below the fold, and preload only the hero image.

**Accessibility.** Real `<label>` elements, never placeholder-as-label. Visible focus states.
Errors announced via `aria-live` and tied to their field. Correct heading order. The figure needs a
genuine `alt` describing what it shows, including the figure. Contrast at AA minimum throughout —
`--ink-500` on `--paper-100` should be checked, not assumed.

---

## 14 · Claim safety — binding

Non-negotiable, and inherited from the rest of the project.

**Permitted:** everything already published on gdpvision.com; everything in the op-eds with its
citation and grade attached; the four provenance claims (OPEN Interactive seventeen years, Caribbean
Investment Summit from 2009, St. Kitts & Nevis under confidential engagement, SEDE as the Saint Lucia
prototype); the architectural sovereignty claims.

**Forbidden:**

- Any statistic without its source and confidence grade. **If a figure will not fit alongside its
  citation, cut the figure.**
- Any outcome attributed to GDPVision — no percentage improvement, time saved, or revenue gained.
- "World's first", "only", "leading", or any unevidenced superlative.
- Any client named as a customer beyond the two engagements, in the published wording.
- Any implication of multiple live government deployments.
- Download counts, "trusted by", or logo walls. We do not have the rights and it would breach the
  confidentiality the sovereignty story depends on.
- Pricing, in any form.

---

## 15 · Acceptance criteria

**Content**

- [ ] Eight landing pages plus an index, all rendering from one `content.ts`
- [ ] Every source string matches the op-ed frontmatter character-for-character
- [ ] Sources and the three-paragraph excerpt are visible **without** submitting the form
- [ ] No statistic appears anywhere without its citation and grade
- [ ] No forbidden claim per §14 anywhere in the build

**Conversion**

- [ ] Form has exactly four visible fields plus the honeypot
- [ ] PDF opens immediately on submit; no email required to receive it
- [ ] Success state replaces the form inline, preserving scroll position
- [ ] Briefing cross-sell appears only after successful submit
- [ ] No popup, no sticky bar, no chat widget, no countdown anywhere on the site

**Technical**

- [ ] `op_ed_requests` migration includes GRANTs and RLS in the same file
- [ ] Server fn validates with zod, honeypot returns silent success, admin client imported inside
      the handler
- [ ] UTM parameters, referrer, and user agent persist to the lead row
- [ ] Signed URLs expire; the storage bucket is not public
- [ ] `bun run lint` and `bun run check:maps` pass
- [ ] Server-fn header docblock present (`@domain`, `@tables`, `@ui`)

**Quality**

- [ ] Headline fully visible above the fold at 390 × 844
- [ ] LCP < 2.5s on a throttled 4G profile
- [ ] Unique OG image per op-ed; verified in the LinkedIn post inspector
- [ ] Lighthouse accessibility ≥ 95
- [ ] Keyboard-only completion of the form works end to end

---

## 16 · Out of scope

- Email delivery and any email provider (§8) — later phase if at all
- Newsletter, drip sequence, or marketing automation
- Comments, reactions, or social embeds on the pages
- A/B testing framework — ship the eight, read the spread first
- Translation. **[Phase 2 note: CARICOM includes Haiti and Suriname. French and Dutch are a real
  gap, and Haiti is a large SIDS market currently unable to read any of this in its own language.]**
- Any change to authenticated surfaces, the chambers, or the kiosk

---

## 17 · Open questions for Adam

1. **Email provider** — add one now, later, or not at all? Blocks the "also sent to your inbox" line.
2. **Analytics** — first-party into Supabase, or a third party? §10 recommends first-party.
3. **Follow-up promise** — the form says "OPEN Interactive may write to you once, from a named
   person." Confirm that is the intent, because it must be true.
4. **Nav label** — `The writing`, `Op-eds`, or something else in the header?
5. **URL shape** — `/op-eds/fdi-transition-studio` as specified, or `/writing/...`? Decide before
   launch; changing it after the campaign starts breaks every posted link.

---

## 18 · Build order

| Stage | Scope | Why first |
|---|---|---|
| 1 | Asset ingestion, `content.ts`, migration + server fn | Nothing renders without it |
| 2 | **Chamber 04 page, complete** | Prove the pattern on the strongest op-ed before multiplying it eight times |
| 3 | Review 04 end to end on a phone, then build the remaining seven | Cheap to fix once, expensive to fix eight times |
| 4 | Index page and header nav | |
| 5 | OG images, structured data, performance pass | Before any traffic arrives, not after |
| 6 | UTM capture and lead review surface | Must be live before the first post |

**Do not start the LinkedIn campaign until stage 6 is complete.** The first post is the highest-
traffic moment the site will have, and running it into a page without attribution wastes the only
clean read we will ever get on which argument pulls.
