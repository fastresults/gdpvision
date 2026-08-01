## What the screenshot shows

The page in the PDF is not our Table of Contents. It is the client's own RFP text pasted verbatim into the briefing: `commencement-briefing.server.ts` builds the first section ("The brief") by inserting the whole governing-brief text (`committedText`) under "Your question, in your words". That text came out of a parsed PDF with its line breaks lost, so the client's own contents list ("Table of Contents Executive Summary Company Profile & Overview …") reflows as one run-on paragraph, along with "SUBMITTED BY …" cover lines.

Our real contents page exists (`PrintableBriefing.tsx`, `cb-toc`) but it is optional (`showToc`), and the "Print" button exports with whatever config is in state — so the structured contents page can be absent while the raw dump is present.

## Plan

**1. Always present the contents page**
- Make the contents page non-optional in the exported PDF: contents renders whenever the document has 2+ sections; remove the ability to ship a dossier with no TOC (keep cover/page-number toggles).
- Number the contents entries to match section numbers already printed on each section head, and add a right-hand page indicator column so it reads as a real TOC rather than a list.

**2. Stop the raw brief from impersonating a contents page**
- In `commencement-briefing.server.ts`, replace the verbatim `committedText` insertion with a normalised, bounded quotation:
  - strip cover/administrative furniture (SUBMITTED BY / CONFIDENTIAL / PREPARED EXCLUSIVELY FOR lines) and any inline "Table of Contents …" run;
  - re-flow the parsed text into paragraphs and clamp it to a short quoted mandate excerpt;
  - keep the full governing text where it belongs — provenance/audit — not in the body of the client dossier.
- Render the excerpt as a blockquote so it is visibly the client's words, not our narrative.

**3. Print CSS**
- Keep the contents page on its own sheet (`break-after: page`) and prevent it colliding with the first section.
- Guard against the reverse case: if the cover page is off, the contents page must still start the document cleanly under the `@page :first` margins.

**4. Verify**
- Assemble the Grenada briefing, export to PDF headlessly, render every page to an image, and confirm: page 1 cover, page 2 structured contents with one line per section, no run-on RFP contents text, no clipped margins.

## Technical notes

Files touched: `src/lib/personas/commencement-briefing.server.ts` (brief section assembly + text normaliser), `src/components/personas/field/briefing/PrintableBriefing.tsx` (contents always rendered, page column, print CSS), `src/components/personas/field/briefing/ExportBriefingDialog.tsx` (drop the TOC toggle). Existing briefings need one re-assemble to pick up the cleaned brief section; the panel already prompts for re-assembly.
