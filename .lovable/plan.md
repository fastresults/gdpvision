## Problem

The two client-facing artefacts — the Commencement Briefing (PDF) and the Commencement Deck (on-screen, print, .pptx) — carry internal platform vocabulary that the client never gave us: "GDPVision", "Chamber 07", "second brain", "the National Ledger / Cabinet Room / Narrative Chamber". Confirmed in the code:

- `PrintableBriefing.tsx` — cover kicker "Chamber 07 · Commencement Briefing"; default `preparedBy` "GDPVision · Chamber 07 · Research"; running footer `content: "GDPVision · Commencement Briefing"`.
- `commencement-briefing.server.ts` — milestone owner falls back to "GDPVision"; the evidence section ends with a sentence about filing to "your country's second brain … any chamber — the National Ledger, the Cabinet Room, the Narrative Chamber"; the AI narrative prompt instructs the model to write about the "second brain".
- `programme-deck.server.ts` — closing slide note "GDPVision · Chamber 07 · Research Chamber".
- `SlideCanvas.tsx` — every slide footer defaults to "GDPVision · Chamber 07".
- `deck-pptx.ts` — pptx `author`/`company` "GDPVision", slide footer default "GDPVision · Chamber 07".

## Rule to enforce

Client-facing output draws its identity strictly from the governing brief: the programme title, its subtitle, the country, the fieldwork window, the version, and whatever the admin types into the export dialog. No product, chamber or internal-architecture name appears anywhere in the artefacts.

## Changes

**1. Briefing document (`PrintableBriefing.tsx`)**
- Cover kicker becomes "Commencement Briefing" (no chamber).
- Default `preparedBy` becomes an empty/neutral value the admin fills in the export dialog; when blank, the "Prepared by" cell is omitted rather than printing a placeholder.
- Running footer becomes the programme title + "Commencement Briefing", derived from the briefing, not a hardcoded product name.

**2. Briefing content (`commencement-briefing.server.ts`)**
- Milestone owner fallback "GDPVision" → "—" (unassigned), so we never assert an owner the brief did not name.
- Rewrite the closing evidence sentence in plain client language: findings are filed to the client's own evidence base with provenance intact, available for citation in later work. No product or chamber names.
- Amend the AI narrative system prompt: remove the "second brain" instruction, and add an explicit constraint — never name the platform, its chambers, or any internal system; refer only to the client, the programme and its deliverables.

**3. Deck (`programme-deck.server.ts`)**
- Closing slide note becomes the programme title + fieldwork window (or a neutral "Commencement briefing · v{n}"), not a product line.
- Add the same "no platform or internal-system names" constraint to `DECK_SYSTEM` so model-written headings, bullets and notes can't reintroduce them.

**4. Deck rendering (`SlideCanvas.tsx`, `deck-pptx.ts`)**
- Slide footer default falls back to the programme title instead of "GDPVision · Chamber 07"; pass the programme title down where the footer needs it.
- `.pptx` metadata `author`/`company` set from the programme title / country rather than "GDPVision".

**5. Export dialog (`ExportBriefingDialog.tsx`)**
- Keep "Prepared for" / "Prepared by" as free-text fields, but seed them from the brief (country / programme) instead of a product default, so the admin's own agency naming is what appears.

## Not in scope

Internal admin UI chrome (panel headers such as "Chamber 07 · Client dossier"), source-file docblocks, and route labels stay as they are — they are never seen by the client.

## Verification

Assemble a briefing and deck for the current GRD programme, export both to PDF and .pptx, and grep the rendered text (plus the pptx XML) for "GDPVision", "Chamber", "second brain" and the chamber names to confirm zero hits.
