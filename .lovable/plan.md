## Plan: make uncited citations impossible

### What I verified
- The current persona record for Kamal Joseph has `summary` markers like `[24]`, but its persisted `citations` array is empty.
- Chamber 07’s context pack currently creates citation numbers for internal records such as sector, KPI, ministry, signal, and memory rows even when they do not carry a public URL.
- The citation UI currently allows those weak/internal citations to render as clickable superscripts and then shows “No URL on file,” which violates the product rule.

### Product rule to enforce
A citation marker must only appear when it resolves to an actual citable source with a valid public URL. If no source URL exists, the marker must be removed from the prose and no citation chip/modal should render.

### Implementation steps
1. **Create a single citation hygiene layer**
   - Add reusable helpers to validate citation URLs, filter citation arrays to only valid public sources, renumber citations, and strip unsupported `[N]` markers from generated text/markdown.
   - Treat labels, refs, internal IDs, KPI codes, and memory IDs as context only, not citations.

2. **Fix Chamber 07 grounding at the source**
   - Refactor the persona context pack so every cited item comes from a source-backed record: country source URLs, KPI `source_url`, signal `url`, or source-linked corpus data.
   - Stop numbering ministries, sectors, memory objects, and other internal-only context unless they can be resolved to a public source URL.
   - Keep internal context available to AI, but mark it as “context only — do not cite.”

3. **Sanitize AI outputs before saving**
   - In persona generation, segment generation, study runs, reports, and persona chat, filter citations to URL-backed sources only.
   - Remove any `[N]` marker from saved summaries, answers, transcripts, rationales, reports, and chat messages if that number does not resolve to a valid source.
   - Prevent fallback hydration from recreating no-URL citations for legacy rows.

4. **Harden the global citation renderers**
   - Update `CitedText`, `CitedMarkdown`, and `PrettyJson` so orphan/invalid citation markers are silently removed instead of producing a dead source popover.
   - Remove all “No URL on file” citation states from user-facing citation modals. If there is no URL, there is no citation.

5. **Backfill visible legacy data**
   - Add a safe backend cleanup migration/function to sanitize existing Chamber 07 persona, study, transcript, response, report, and chat rows:
     - keep valid URL-backed citations;
     - remove dead citation metadata;
     - strip citation markers that no longer resolve.
   - This will fix existing records like the Kamal Joseph persona instead of only fixing future generations.

6. **Verify the exact failure case**
   - Re-open the current persona route and confirm there are no citation chips that open “No URL on file.”
   - Confirm valid citations still show as superscript chips and open a modal with a live source link.

### Technical notes
- Files likely involved: citation components, Chamber 07 persona/study server functions, and the country context pack.
- Database work is limited to data cleanup/backfill; no new product tables are expected unless the existing schema lacks a safe way to persist sanitized citation metadata.