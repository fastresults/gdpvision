## Goal

Give the presentation its own client link — `https://gdpvision.com/p/<token>` — that opens only the deck, with no sign-in and no platform chrome, exactly as the Discovery brief link works today.

## What the client sees

A single unbranded page with the deck: slide-by-slide viewing, full-screen present mode, print/save-as-PDF, and download as editable .pptx. Nothing about the workspace, country queue, or platform. Revoked or unpublished links show a plain notice.

## What the admin sees

Beside the existing "Client link" bar for the brief, a second **Presentation link** bar in the briefing panel: Create client link → address field with Copy, plus New address and Revoke. The button stays disabled until the deck exists and its provenance check passes, mirroring the brief's gate.

## Technical outline

1. **Migration** — add `share_token text unique`, `share_enabled boolean default false`, `shared_publicly_at timestamptz` to `public.programme_decks` (mirrors `programme_briefings`); no new table, so no new GRANTs needed beyond what exists.
2. **Server fns** — `getDeckShare` / `setDeckShare` in `src/lib/personas/programme-deck.functions.ts`, protected by `requireSupabaseAuth`, same create/regenerate/revoke shape as `setDossierShare`. Publishing refuses unless the stored deck passes its preflight and matches the current briefing version.
3. **Public API** — `src/routes/api/public/deck/$token.ts`: token-format check, admin client lookup by `share_token`, returns `invalid` / `revoked` / `unavailable` / `ok` + the deck JSON only.
4. **Public page** — `src/routes/p.$token.tsx`, reusing `DeckModal`'s slide canvas and `deck-pptx` export in an always-open, page-level layout; own `head()` with noindex.
5. **Link spelling** — add `deckLink(origin, token)` to `src/lib/personas/public-origin.ts` so the address always resolves through `browserPublicOrigin()` and never the preview host.
6. **UI** — generalise `ShareLinkBar` to take label/copy + read/write fns (or add a thin `DeckShareLinkBar`) and mount it under the existing one in `BriefingPanel.tsx`.

Regenerating the deck keeps the same token (address stays stable) unless the admin asks for a new address.
