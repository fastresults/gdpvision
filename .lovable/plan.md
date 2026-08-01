## What the logs and settings show

- The published site is live and **public** — nothing on it requires a Lovable account.
- Every participant link is built from `window.location.origin` at the moment an admin issues it: `src/lib/personas/fieldwork.functions.ts` (`${data.origin}/f/${token}`), `comms.functions.ts` (survey + opt-out links) and `DeployPanel.tsx` (open link).
- Admins work in the **preview** host (`id-preview--….lovableproject.com`). That host is the Lovable workspace preview and *always* asks for a Lovable login. So the link is correct but pointed at the wrong front door — that is the login screen participants are hitting.

## Part A — links must be free-standing

1. Add a single source of truth for the public base address: `src/lib/personas/public-origin.ts`, resolving in order — configured public site URL → the request/published host → `window.location.origin` as last resort — and *never* returning a `lovableproject.com` / `id-preview--` host.
2. Have the server functions stop trusting the client-sent `origin`: `issueInvitations` and the comms sender resolve the base themselves on the server, keeping the client value only as a fallback for local dev.
3. `DeployPanel.tsx` and `CollectionWave.tsx` show and copy the resolved public link, not the browser origin.
4. Add a visible reassurance line under any copied link: the exact address, plus "opens without a login".
5. Backfill nothing in the database — links are tokens, only the host changes, so all previously issued tokens work the moment they are re-sent from the correct host. Add an "affected invitations" note in the wave card so an admin knows to re-send any invite issued before the fix.

## Part B — the participant page becomes a proper front door

Rebuild `src/routes/f.$token.tsx` presentation only (the API contract at `src/routes/api/public/field.$token.ts` is unchanged):

- **Masthead**: programme wordmark, "Confidential research", the instrument title, estimated time to complete, and a one-line statement of who is asking and why.
- **Instruction beat before question one**: how answers are used, that they are reported only in aggregate, that progress is saved automatically, and that they may stop at any time.
- **Progress**: a sticky slim progress bar with "N of M answered", replacing the count buried at the bottom.
- **Question cards**: generous spacing, clear required marks, per-question help text, larger touch targets for scale/choice on mobile.
- **Submit**: a sticky footer action with required-question guidance that names the first unanswered question and scrolls to it, rather than a bare count.
- **Terminal states** (done / closed / opted out / not recognised) get the same masthead treatment plus a courteous closing line — no bare notice text.
- Fully mobile-first; no app chrome, no navigation, no login affordance anywhere on the page.

## Technical notes

- Nothing moves under `/api/public/*`; the page route `/f/$token` is already public on the published domain — the only defect was the host baked into issued links.
- A `PUBLIC_SITE_URL` value (e.g. `https://gdpvision.com`) will be read server-side so the resolved host is deterministic regardless of who issues the link.
- Deploy/export packs (printable form, CSV, JSON) will stamp the same public host.
