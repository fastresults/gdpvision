# Chamber outcome captions

Add one short outcome line to every chamber card on the home page, placed directly under the header image. Each line is a command-length promise: imperative verb, one object, under eight words, full stop. It is the line a Prime Minister reads while scrolling; the paragraph below it stays as the explanation.

## Recommended copy

| # | Chamber | Outcome statement |
| --- | --- | --- |
| 01 | The National Ledger | Know what your nation can prove. |
| 02 | Portfolio Workspaces | Make every minister accountable for growth. |
| 03 | The Scenario Engine | Rehearse the consequences before you commit. |
| 04 | The FDI Transition Studio | Increase foreign direct investment. |
| 05 | The Narrative Chamber | Manage national perceptions. |
| 06 | The Cabinet Room | Empower cabinet members. |
| 07 | The Persona Lab | Conduct synthetic and field research. |
| 08 | The Mandate Compact | Turn the mandate into delivered results. |
| 09 | The Digital Government Studio | Build e-government platforms. |
| 10 | The Sector Studio | Build insightful sector development plans. |

Four lines are new (01, 02, 03, 08); the other six are yours, unchanged. Two of yours could be sharper if you want them: chamber 10 becomes "Build sector plans that move growth." and chamber 07 becomes "Test policy before the public does." Both keep your originals as the default above — say the word and I will swap either.

Every line is backed by what the chamber already does on the page: confidence grades and sources (01), portfolio GDP exposure and delivery measures (02), lever-based scenario comparison (03), investment packages and readiness testing (04), cited positions approved by principals (05), owned commitments tracked between sessions (06), guided audience studies (07), pledges translated to owners and review dates (08), cited requirements and independent approval (09), sector ranking and roadmap (10). Nothing claims a result the platform has not shown.

## Visual treatment

The line sits between the image and the chamber title, in the same serif as the titles but smaller, at near-black ink, with a short accent tick in the chamber's own sector hue above it. This makes the card read in a deliberate order: evidence (image) then outcome (statement) then name (title) then method (paragraph and bullets). The statement stays a plain text node so screen readers announce it in sequence and no colour is the only signal.

```text
┌──────────────────────────────┐
│  Chamber 04            ⌁ art │
│                              │
│  [ product screenshot      ] │
│                              │
│  ▬▬  ← sector-hue tick      │
│  Increase foreign direct     │
│  investment.                 │
│                              │
│  The FDI Transition Studio   │
│  Replace exposed revenue ... │
│  · Price the revenue gap     │
└──────────────────────────────┘
```

## How it is built

- `src/lib/chambers.ts`: add an `outcome: string` field to the `Chamber` interface and one line per chamber in the table above. It is the single source of truth, so any other surface that later wants the line reads it from here.
- `src/components/marketing/ChamberPanel.tsx`: accept `outcome` and render the tick plus the statement immediately after the screenshot block, before the `<h3>`. Cards without a screenshot still show it.
- `src/components/marketing/MarketingHome.tsx`: the two featured chambers (04, 08) pass props explicitly, so `outcome` is added to that call; the grid already spreads the whole chamber object and picks it up automatically.
- Styling uses existing tokens only (`font-serif`, `text-ink-950`, the chamber's registered `--sector-*` variable), so no new colours are introduced and dark or print contexts are unaffected.
- Scope is the home page only. The op-ed landing pages keep their current copy untouched; the field is available to them if you later want the same line there.

## Verification

Typecheck and the map check run after the edit, then the home page is opened in a browser at desktop and phone widths to confirm all ten captions render under their images, none wraps awkwardly, and the featured pair matches the grid. Build output is checked for errors before the work is reported as done.
