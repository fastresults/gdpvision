## 1. Why every tile says "0 prohibited references"

Nothing is broken. Each tile in the provenance strip prints a raw count of banned internal terms found in that section. Zero is the *pass* state — it means the section is clean. The wording just reads like a warning when it is actually the all-clear.

**Fix (presentation only):**
- Clean sections show a check plus "Clean — drawn from the governing brief" instead of "0 prohibited references".
- Only sections with a count above zero show the red count and the offending term.
- The header keeps the single verdict badge ("Ready to export" / "Export blocked") and adds a plain line: "All N sections trace to the client brief; no internal platform references found."

## 2. Public, shareable dossier link

Give each project one durable link that opens the **whole dossier** — the discovery brief and the presentation deck — with no sign-in and no reference to the platform, the chamber, or GDPVision.

**Database**
- Add `share_token` (unique, random hex), `share_enabled` (bool, default false), `shared_publicly_at` to `programme_briefings`. The deck is resolved through the same token via its `project_id`, so no second token.

**Public endpoint** — `src/routes/api/public/dossier/$token.ts`
- Validates the token shape, loads the briefing and the matching deck with the admin client, and returns only the assembled `document`, the deck slides, and the client identity taken from the governing brief.
- Runs the existing banned-term check server-side before responding; if anything internal slipped in, the endpoint returns "unavailable" rather than leaking it.
- No project ids, no country codes, no participant PII, `no-store`, `noindex`.

**Public page** — `src/routes/d/$token.tsx`
- Standalone shell: no app header, no wordmark, no navigation. Masthead is the client and programme name from the brief.
- Two tabs: **Discovery brief** (the reader, contents rail, print to PDF) and **Presentation** (the slide viewer with fullscreen), reusing the existing printable and deck components but rendered without the internal chrome and without the provenance/tracker controls.
- Revoked or disabled link renders a quiet "This link is no longer active" notice.

**Admin controls** (in the briefing panel, beside "Mark as sent to client")
- "Create share link" → generates the token and copies the URL.
- Shows the live URL with copy button, plus "Revoke link" and "Regenerate link".
- Sharing is blocked while the export preflight is blocked, so an unclean dossier can never be published.

## Technical notes

- Migration adds the three columns to `programme_briefings` with GRANTs untouched (existing table) and keeps all reads for the public route on the service-role client inside the handler — no anon policy widening.
- Token generated with `gen_random_bytes` server-side; never derived from the project id.
- Public route lives outside `_authenticated`, its loader calls only the public endpoint, so prerender never touches a protected function.
- Deck and briefing rendering are extracted into presentational components that take data as props, so the internal modal and the public page share one implementation and cannot drift.
